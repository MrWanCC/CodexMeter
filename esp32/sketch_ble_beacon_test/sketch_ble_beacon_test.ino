#include <Arduino.h>
#include <NimBLEDevice.h>

#define BLE_TEST_NAME "BLETEST"
#define BLE_TEST_SERVICE_UUID "ABCD"

void setup() {
  Serial.begin(115200);
  delay(800);
  Serial.println("BLE beacon test start");

  NimBLEDevice::init(BLE_TEST_NAME);
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);

  NimBLEServer* server = NimBLEDevice::createServer();
  NimBLEService* service = server->createService(BLE_TEST_SERVICE_UUID);
  NimBLECharacteristic* characteristic = service->createCharacteristic(
    "1234",
    NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE
  );
  characteristic->setValue("hello");
  service->start();

  NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
  advertising->setName(BLE_TEST_NAME);
  advertising->addServiceUUID(BLE_TEST_SERVICE_UUID);
  advertising->enableScanResponse(true);
  advertising->start();

  Serial.println("BLETEST advertising");
}

void loop() {
  delay(1000);
}
