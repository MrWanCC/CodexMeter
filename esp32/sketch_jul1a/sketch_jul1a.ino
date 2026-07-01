#include <Wire.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include "secrets.h"

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define OLED_SDA 6
#define OLED_SCL 4
#define OLED_RESET -1

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
WebServer server(80);

int fiveHourRemaining = 0;
int weeklyRemaining = 0;
String fiveHourStatus = "EMPTY";
String weeklyStatus = "EMPTY";
String fiveHourReset = "--";
String weeklyReset = "--";
String lastRefresh = "--:--";
String planName = "Codex";

String shortStatus(String status) {
  status.toUpperCase();

  if (status == "ENOUGH") return "OK";
  if (status == "NORMAL") return "NORM";
  if (status == "WATCH") return "WATCH";
  if (status == "TIGHT") return "TIGHT";
  if (status == "WARNING") return "WARN";
  if (status == "EMPTY") return "EMPTY";

  return status;
}

void drawBar(int x, int y, int w, int h, int percent) {
  percent = constrain(percent, 0, 100);

  display.drawRect(x, y, w, h, SSD1306_WHITE);

  int fillW = (w - 2) * percent / 100;
  display.fillRect(x + 1, y + 1, fillW, h - 2, SSD1306_WHITE);
}

void drawHeader() {
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  display.setCursor(0, 0);
  display.print("CodexMeter");

  display.setCursor(92, 0);
  display.print(lastRefresh);

  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);
}

void drawUsageRow(int topY, const char* label, int remaining, String status, String reset) {
  display.setTextSize(1);

  display.setCursor(0, topY);
  display.print(label);

  display.setCursor(22, topY);
  display.print(remaining);
  display.print("%");

  display.setCursor(60, topY);
  display.print(shortStatus(status));

  display.setCursor(98, topY);
  display.print(reset);

  drawBar(0, topY + 10, 128, 8, remaining);
}

void drawScreen() {
  display.clearDisplay();
  drawHeader();

  drawUsageRow(14, "5H", fiveHourRemaining, fiveHourStatus, fiveHourReset);
  drawUsageRow(38, "7D", weeklyRemaining, weeklyStatus, weeklyReset);

  display.display();
}

void showMessage(String line1, String line2 = "") {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("CodexMeter");
  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  display.setCursor(0, 22);
  display.println(line1);

  if (line2.length() > 0) {
    display.setCursor(0, 36);
    display.println(line2);
  }

  display.display();
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting Wi-Fi: ");
  Serial.println(WIFI_SSID);
  showMessage("WiFi connecting");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("Wi-Fi connected, IP: ");
  Serial.println(WiFi.localIP());
  showMessage("WiFi connected", WiFi.localIP().toString());
}

void sendJson(int statusCode, String body) {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(statusCode, "application/json", body);
}

void handleHealth() {
  StaticJsonDocument<192> doc;
  doc["ok"] = true;
  doc["device"] = "CodexMeter ESP32-C3";
  doc["version"] = "0.1.0";
  doc["ip"] = WiFi.localIP().toString();

  String body;
  serializeJson(doc, body);
  sendJson(200, body);
}

void handleQuota() {
  if (!server.hasArg("plain")) {
    sendJson(400, "{\"ok\":false,\"error\":\"missing_body\"}");
    return;
  }

  String body = server.arg("plain");
  Serial.print("POST /quota ");
  Serial.println(body);

  StaticJsonDocument<768> doc;
  DeserializationError error = deserializeJson(doc, body);

  if (error) {
    Serial.print("JSON parse failed: ");
    Serial.println(error.c_str());
    sendJson(400, "{\"ok\":false,\"error\":\"invalid_json\"}");
    showMessage("JSON error");
    return;
  }

  planName = doc["plan"] | "Codex";
  lastRefresh = doc["lastRefresh"] | "--:--";

  JsonObject fiveHour = doc["fiveHour"];
  JsonObject weekly = doc["weekly"];

  fiveHourRemaining = constrain(fiveHour["remaining"] | 0, 0, 100);
  fiveHourStatus = fiveHour["status"] | "empty";
  fiveHourReset = fiveHour["reset"] | "--";

  weeklyRemaining = constrain(weekly["remaining"] | 0, 0, 100);
  weeklyStatus = weekly["status"] | "empty";
  weeklyReset = weekly["reset"] | "--";

  drawScreen();
  sendJson(200, "{\"ok\":true}");
}

void handleOptions() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.send(204);
}

void setupRoutes() {
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/quota", HTTP_POST, handleQuota);
  server.on("/quota", HTTP_OPTIONS, handleOptions);
  server.onNotFound([]() {
    sendJson(404, "{\"ok\":false,\"error\":\"not_found\"}");
  });
  server.begin();
  Serial.println("HTTP server started");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("CodexMeter ESP32-C3 HTTP START");

  Wire.begin(OLED_SDA, OLED_SCL);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED init failed");
    while (true) {
      delay(1000);
    }
  }

  Serial.println("OLED init OK");
  showMessage("Booting");

  connectWiFi();
  setupRoutes();
}

void loop() {
  server.handleClient();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi disconnected, reconnecting");
    showMessage("WiFi reconnect");
    connectWiFi();
  }
}
