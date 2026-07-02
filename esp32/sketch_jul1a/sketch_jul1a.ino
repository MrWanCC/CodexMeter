#include <Wire.h>
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <NimBLEDevice.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define OLED_SDA 6
#define OLED_SCL 4
#define OLED_RESET -1

#define BLE_DEVICE_NAME "CodexMeter"
#define BLE_SERVICE_UUID "6f4d0001-9c8f-4c2a-9f12-000000000001"
#define BLE_USAGE_UUID "6f4d0002-9c8f-4c2a-9f12-000000000002"

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
WebServer server(80);
DNSServer dnsServer;
Preferences preferences;

const byte DNS_PORT = 53;
const char* WIFI_PREF_NAMESPACE = "codexmeter";
const char* SETUP_AP_SSID = "CodexMeter-Setup";
const char* SETUP_AP_PASSWORD = "12345678";

int fiveHourRemaining = 0;
int weeklyRemaining = 0;
String fiveHourStatus = "EMPTY";
String weeklyStatus = "EMPTY";
String fiveHourReset = "--";
String weeklyReset = "--";
String lastRefresh = "--:--";
String planName = "Codex";
bool displayReady = false;
bool configPortalActive = false;
bool serverStarted = false;
bool routesRegistered = false;
bool dnsServerStarted = false;
bool bleConnected = false;
bool restartAdvertising = false;

const char* wifiStatusText(wl_status_t status);
bool connectWiFi(unsigned long timeoutMs = 30000);
void startConfigPortal(String reason = "No WiFi config");
void setupBle();
void startBleAdvertising();

String compactReset(String reset) {
  int spaceIndex = reset.indexOf(' ');
  if (spaceIndex > 0) {
    return reset.substring(0, spaceIndex);
  }

  return reset;
}

int textWidth(String text, int textSize = 1) {
  return text.length() * 6 * textSize;
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

void drawUsageRow(int topY, const char* label, int remaining, String reset) {
  String percentText = String(remaining) + "%";
  String resetText = compactReset(reset);
  int percentX = 28;
  int resetX = max(92, 128 - textWidth(resetText));

  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  display.setCursor(0, topY);
  display.print(label);

  display.setCursor(percentX, topY);
  display.print(percentText);

  display.setCursor(resetX, topY);
  display.print(resetText);

  drawBar(0, topY + 11, 128, 8, remaining);
}

void drawScreen() {
  if (!displayReady) {
    return;
  }

  display.clearDisplay();
  drawHeader();

  drawUsageRow(15, "5H", fiveHourRemaining, fiveHourReset);
  drawUsageRow(39, "7D", weeklyRemaining, weeklyReset);

  display.display();
}

void showMessage(String line1, String line2 = "") {
  if (!displayReady) {
    return;
  }

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

void applyBleUsageJson(String body) {
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, body);
  if (error) {
    Serial.print("BLE JSON parse failed: ");
    Serial.println(error.c_str());
    showMessage("BLE JSON error");
    return;
  }

  lastRefresh = doc["t"] | "--:--";
  planName = doc["p"] | "Codex";
  fiveHourRemaining = constrain(doc["h"] | 0, 0, 100);
  fiveHourReset = doc["hr"] | "--";
  weeklyRemaining = constrain(doc["w"] | 0, 0, 100);
  weeklyReset = doc["wr"] | "--";
  drawScreen();
}

class UsageCharacteristicCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* characteristic, NimBLEConnInfo& connInfo) override {
    String body = characteristic->getValue().c_str();
    Serial.print("BLE usage ");
    Serial.println(body);
    applyBleUsageJson(body);
  }
};

class DisplayServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* server, NimBLEConnInfo& connInfo) override {
    bleConnected = true;
    restartAdvertising = false;
    Serial.println("BLE connected");
    showMessage("BLE connected", BLE_DEVICE_NAME);
  }

  void onDisconnect(NimBLEServer* server, NimBLEConnInfo& connInfo, int reason) override {
    bleConnected = false;
    restartAdvertising = true;
    Serial.println("BLE disconnected");
    showMessage("BLE advertising", BLE_DEVICE_NAME);
  }
};

void startBleAdvertising() {
  NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
  advertising->start();
}

void setupBle() {
  NimBLEDevice::init(BLE_DEVICE_NAME);
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);
  NimBLEDevice::setMTU(128);

  NimBLEServer* bleServer = NimBLEDevice::createServer();
  bleServer->setCallbacks(new DisplayServerCallbacks());
  NimBLEService* service = bleServer->createService(BLE_SERVICE_UUID);
  NimBLECharacteristic* usage = service->createCharacteristic(
    BLE_USAGE_UUID,
    NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
  );
  usage->setCallbacks(new UsageCharacteristicCallbacks());
  service->start();

  NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
  advertising->setName(BLE_DEVICE_NAME);
  advertising->addServiceUUID(BLE_SERVICE_UUID);
  advertising->enableScanResponse(true);
  advertising->setMinInterval(160);
  advertising->setMaxInterval(240);
  startBleAdvertising();
  Serial.println("BLE advertising");
}

String htmlEscape(String value) {
  value.replace("&", "&amp;");
  value.replace("<", "&lt;");
  value.replace(">", "&gt;");
  value.replace("\"", "&quot;");
  return value;
}

String savedWifiSsid() {
  preferences.begin(WIFI_PREF_NAMESPACE, true);
  String ssid = preferences.getString("ssid", "");
  preferences.end();
  return ssid;
}

String savedWifiPassword() {
  preferences.begin(WIFI_PREF_NAMESPACE, true);
  String password = preferences.getString("password", "");
  preferences.end();
  return password;
}

void saveWifiConfig(String ssid, String password) {
  preferences.begin(WIFI_PREF_NAMESPACE, false);
  preferences.putString("ssid", ssid);
  preferences.putString("password", password);
  preferences.end();
}

void clearWifiConfig() {
  preferences.begin(WIFI_PREF_NAMESPACE, false);
  preferences.remove("ssid");
  preferences.remove("password");
  preferences.end();
}

bool connectWiFi(unsigned long timeoutMs) {
  String ssid = savedWifiSsid();
  String password = savedWifiPassword();
  if (ssid.length() == 0) {
    Serial.println("No saved Wi-Fi config");
    return false;
  }

  configPortalActive = false;
  if (dnsServerStarted) {
    dnsServer.stop();
    dnsServerStarted = false;
  }
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(300);
  WiFi.begin(ssid.c_str(), password.c_str());

  Serial.print("Connecting Wi-Fi: ");
  Serial.println(ssid);
  showMessage("WiFi connecting");

  unsigned long startedAt = millis();
  int dotCount = 0;

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    dotCount++;

    if (dotCount % 10 == 0) {
      wl_status_t status = WiFi.status();
      Serial.print(" status=");
      Serial.println(wifiStatusText(status));
      showMessage("WiFi connecting", wifiStatusText(status));
    }

    if (millis() - startedAt > timeoutMs) {
      wl_status_t status = WiFi.status();
      Serial.println();
      Serial.print("Wi-Fi connect timeout, status=");
      Serial.println(wifiStatusText(status));
      showMessage("WiFi failed", wifiStatusText(status));
      WiFi.disconnect();
      return false;
    }
  }

  Serial.println();
  Serial.print("Wi-Fi connected, IP: ");
  Serial.println(WiFi.localIP());
  showMessage("WiFi connected", WiFi.localIP().toString());
  return true;
}

const char* wifiStatusText(wl_status_t status) {
  switch (status) {
    case WL_IDLE_STATUS:
      return "IDLE";
    case WL_NO_SSID_AVAIL:
      return "NO_SSID";
    case WL_SCAN_COMPLETED:
      return "SCAN_DONE";
    case WL_CONNECTED:
      return "CONNECTED";
    case WL_CONNECT_FAILED:
      return "AUTH_FAIL";
    case WL_CONNECTION_LOST:
      return "LOST";
    case WL_DISCONNECTED:
      return "DISCONNECTED";
    default:
      return "UNKNOWN";
  }
}

void sendJson(int statusCode, String body) {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(statusCode, "application/json", body);
}

void sendHtml(int statusCode, String body) {
  server.send(statusCode, "text/html; charset=utf-8", body);
}

void handleConfigPage() {
  String ssid = htmlEscape(savedWifiSsid());
  String body = "<!doctype html><html><head><meta charset=\"utf-8\">"
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
    "<title>CodexMeter Setup</title>"
    "<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;"
    "font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;background:#eef3f9;color:#111827}"
    "main{width:min(460px,100%);background:#fff;border:1px solid #d8e2f0;border-radius:18px;box-shadow:0 18px 50px rgba(15,23,42,.08);overflow:hidden}"
    ".head{padding:24px 24px 18px;border-bottom:1px solid #edf2f7}.mark{width:38px;height:38px;border-radius:12px;background:#2563eb;color:#fff;"
    "display:grid;place-items:center;font-weight:800;margin-bottom:14px}.eyebrow{margin:0 0 6px;color:#2563eb;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}"
    "h1{font-size:24px;line-height:1.15;margin:0}.hint{margin:10px 0 0;color:#64748b;font-size:14px;line-height:1.5}"
    ".body{padding:20px 24px 24px}.notice{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;margin-bottom:18px;"
    "border-radius:12px;background:#f8fafc;border:1px solid #e5edf6;color:#475569;font-size:13px}.notice b{color:#111827}"
    "label{display:block;margin:14px 0 7px;font-size:13px;font-weight:800;color:#1f2937}input{width:100%;height:44px;padding:0 13px;border:1px solid #cbd5e1;"
    "border-radius:11px;font-size:15px;outline:none;background:#fff}input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}"
    "button{width:100%;height:44px;margin-top:18px;border:0;border-radius:11px;background:#2563eb;color:#fff;font-weight:800;font-size:15px;cursor:pointer}"
    "button:active{transform:translateY(1px)}.steps{margin:18px 0 0;padding:14px 16px;border-radius:14px;background:#f8fafc;color:#64748b;font-size:13px;line-height:1.7}"
    ".steps strong{color:#334155}.reset{display:block;margin-top:16px;color:#64748b;text-align:center;font-size:13px;text-decoration:none}.reset:hover{color:#2563eb}"
    "</style></head><body><main>"
    "<section class=\"head\"><div class=\"mark\">C</div><p class=\"eyebrow\">CodexMeter</p><h1>Connect to your Wi-Fi</h1>"
    "<p class=\"hint\">Save the network used by this screen. After reboot, use the shown IP in CodexMeter HTTP mode.</p></section>"
    "<section class=\"body\"><div class=\"notice\"><span>Setup network</span><b>AP: CodexMeter-Setup</b></div>"
    "<form method=\"post\" action=\"/save\">"
    "<label for=\"ssid\">Wi-Fi name</label><input id=\"ssid\" name=\"ssid\" value=\"" + ssid + "\" placeholder=\"Home Wi-Fi\" required maxlength=\"64\" autocomplete=\"off\">"
    "<label for=\"password\">Password</label><input id=\"password\" name=\"password\" type=\"password\" placeholder=\"Leave blank for open Wi-Fi\" maxlength=\"64\">"
    "<button type=\"submit\">Save and reboot</button></form>"
    "<div class=\"steps\"><strong>Next:</strong> wait for restart, read the IP on OLED or serial monitor, then enter it in the desktop app.</div>"
    "<a class=\"reset\" href=\"/reset\">Clear saved Wi-Fi</a></section></main></body></html>";
  sendHtml(200, body);
}

void handleSaveWifi() {
  String ssid = server.arg("ssid");
  String password = server.arg("password");
  ssid.trim();

  if (ssid.length() == 0) {
    sendHtml(400, "<p>Missing Wi-Fi name.</p><p><a href=\"/\">Back</a></p>");
    return;
  }

  saveWifiConfig(ssid, password);
  sendHtml(200, "<p>Saved. CodexMeter is rebooting.</p>");
  showMessage("WiFi saved", "Restarting");
  delay(800);
  ESP.restart();
}

void handleResetWifi() {
  clearWifiConfig();
  sendHtml(200, "<p>Wi-Fi config cleared. CodexMeter is rebooting.</p>");
  showMessage("WiFi cleared", "Restarting");
  delay(800);
  ESP.restart();
}

void handlePing() {
  StaticJsonDocument<192> doc;
  doc["ok"] = true;
  doc["device"] = "CodexMeter ESP32-C3";
  doc["version"] = "0.1.0";
  doc["ip"] = configPortalActive ? WiFi.softAPIP().toString() : WiFi.localIP().toString();
  doc["mode"] = configPortalActive ? "setup" : "station";

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
  Serial.print("POST usage ");
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
  if (routesRegistered) {
    return;
  }

  Serial.println("Registering HTTP routes");
  server.on("/", HTTP_GET, handleConfigPage);
  server.on("/save", HTTP_POST, handleSaveWifi);
  server.on("/reset", HTTP_GET, handleResetWifi);
  server.on("/ping", HTTP_GET, handlePing);
  server.on("/api/usage", HTTP_POST, handleQuota);
  server.on("/api/usage", HTTP_OPTIONS, handleOptions);
  server.onNotFound([]() {
    if (configPortalActive) {
      handleConfigPage();
      return;
    }
    sendJson(404, "{\"ok\":false,\"error\":\"not_found\"}");
  });
  routesRegistered = true;

  if (!serverStarted) {
    Serial.println("Starting HTTP server");
    server.begin();
    serverStarted = true;
    Serial.println("HTTP server started");
  }
}

void startConfigPortal(String reason) {
  configPortalActive = true;
  WiFi.mode(WIFI_AP);
  bool apStarted = WiFi.softAP(SETUP_AP_SSID, SETUP_AP_PASSWORD);
  delay(300);

  IPAddress apIp = WiFi.softAPIP();
  if (apStarted) {
    dnsServer.start(DNS_PORT, "*", apIp);
    dnsServerStarted = true;
  }

  Serial.print("Config portal active: ");
  Serial.println(reason);
  Serial.print("AP started: ");
  Serial.println(apStarted ? "YES" : "NO");
  Serial.print("AP SSID: ");
  Serial.println(SETUP_AP_SSID);
  Serial.print("AP password: ");
  Serial.println(SETUP_AP_PASSWORD);
  Serial.print("AP IP: ");
  Serial.println(apIp);
  showMessage(apStarted ? "Setup WiFi" : "AP failed", apIp.toString());
  setupRoutes();
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("CodexMeter ESP32-C3 HTTP+BLE START");

  Wire.begin(OLED_SDA, OLED_SCL);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED init failed");
  } else {
    displayReady = true;
    Serial.println("OLED init OK");
  }

  showMessage("Booting");

  if (!connectWiFi()) {
    startConfigPortal("Wi-Fi unavailable");
  } else {
    setupRoutes();
  }
  setupBle();
}

void loop() {
  if (restartAdvertising) {
    delay(300);
    startBleAdvertising();
    restartAdvertising = false;
    Serial.println("BLE advertising restarted");
  }

  if (configPortalActive && dnsServerStarted) {
    dnsServer.processNextRequest();
  }
  server.handleClient();

  if (!configPortalActive && WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi disconnected, reconnecting");
    showMessage("WiFi reconnect");
    if (!connectWiFi(15000)) {
      startConfigPortal("Reconnect failed");
    }
  }
}
