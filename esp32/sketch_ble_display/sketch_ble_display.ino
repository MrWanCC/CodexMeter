#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <NimBLEDevice.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define OLED_SDA 6
#define OLED_SCL 4
#define OLED_RESET -1

#define BLE_DEVICE_NAME "CMeter"
#define BLE_SERVICE_UUID "6f4d0001-9c8f-4c2a-9f12-000000000001"
#define BLE_USAGE_UUID "6f4d0002-9c8f-4c2a-9f12-000000000002"

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

bool bleConnected = false;
bool restartAdvertising = false;
String lastRefresh = "--:--";
String planName = "Codex";
String fiveHourReset = "--";
String weeklyReset = "--";
int fiveHourRemaining = 0;
int weeklyRemaining = 0;

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
  int resetX = max(92, 128 - textWidth(reset));

  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, topY);
  display.print(label);
  display.setCursor(28, topY);
  display.print(percentText);
  display.setCursor(resetX, topY);
  display.print(reset);
  drawBar(0, topY + 11, 128, 8, remaining);
}

void drawScreen() {
  display.clearDisplay();
  drawHeader();
  drawUsageRow(15, "5H", fiveHourRemaining, fiveHourReset);
  drawUsageRow(39, "7D", weeklyRemaining, weeklyReset);
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

void applyUsageJson(String body) {
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
    applyUsageJson(body);
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

  NimBLEServer* server = NimBLEDevice::createServer();
  server->setCallbacks(new DisplayServerCallbacks());
  NimBLEService* service = server->createService(BLE_SERVICE_UUID);
  NimBLECharacteristic* usage = service->createCharacteristic(
    BLE_USAGE_UUID,
    NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
  );
  usage->setCallbacks(new UsageCharacteristicCallbacks());
  service->start();

  NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
  NimBLEAdvertisementData scanResponseData;
  scanResponseData.setName(BLE_DEVICE_NAME);
  advertising->setName(BLE_DEVICE_NAME);
  advertising->addServiceUUID(BLE_SERVICE_UUID);
  advertising->setScanResponseData(scanResponseData);
  advertising->setMinInterval(160);
  advertising->setMaxInterval(240);
  startBleAdvertising();
  Serial.println("BLE advertising");
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("CodexMeter BLE Display START");

  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED init failed");
    return;
  }

  setupBle();
  showMessage("BLE advertising", BLE_DEVICE_NAME);
}

void loop() {
  if (restartAdvertising) {
    delay(300);
    startBleAdvertising();
    restartAdvertising = false;
    Serial.println("BLE advertising restarted");
  }
  delay(1000);
}
