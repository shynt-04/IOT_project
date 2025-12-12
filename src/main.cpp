#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include "DHT.h"
#include "config.h"

DHT dht(DHT_PIN, DHT_TYPE);

WiFiClient espClient;
PubSubClient mqttClient(espClient);

unsigned long lastSensorRead = 0;
unsigned long lastMqttPublish = 0;
float temperature = 0;
float humidity = 0;
float airQualityVoltage = 0;
int airQualityRaw = 0;
bool airQualityAlert = false;

void setupWiFi();
void setupMQTT();
void reconnectMQTT();
void readSensors();
void publishToMQTT();
void handleBuzzer();

void setup() {
    Serial.begin(115200);
    delay(2000);
    
    Serial.println("\n=== ESP32 System Starting ===");
    
    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, LOW);
    analogReadResolution(12);
    analogSetAttenuation(ADC_11db);
    Serial.println("Initializing DHT22...");
    dht.begin();
    setupWiFi();
    setupMQTT();
    Serial.println("=== System Ready ===\n");

}

void loop() {
    if (!mqttClient.connected()) {
        reconnectMQTT();
    }
    mqttClient.loop();
    
    if (millis() - lastSensorRead >= SENSOR_READ_INTERVAL) {
        lastSensorRead = millis();
        readSensors();
        handleBuzzer();
    }
    
    if (millis() - lastMqttPublish >= MQTT_PUBLISH_INTERVAL) {
        lastMqttPublish = millis();
        publishToMQTT();
    }
}

void setupWiFi() {
    Serial.print("Connecting to WiFi: ");
    Serial.println(WIFI_SSID);
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected!");
        Serial.print("IP Address: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\nWiFi connection failed!");
    }
}

void setupMQTT() {
    mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    Serial.print("MQTT Broker: ");
    Serial.print(MQTT_BROKER);
    Serial.print(":");
    Serial.println(MQTT_PORT);
}

void reconnectMQTT() {
    while (!mqttClient.connected()) {
        Serial.print("Connecting to MQTT broker...");
        
        bool connected;
        if (strlen(MQTT_USER) > 0) {
            connected = mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD);
        } else {
            connected = mqttClient.connect(MQTT_CLIENT_ID);
        }
        
        if (connected) {
            Serial.println("Connected!");
            mqttClient.publish(TOPIC_STATUS, "ESP32 Connected");
        } else {
            Serial.print("Failed, rc=");
            Serial.print(mqttClient.state());
            delay(5000);
        }
    }
}

void readSensors() {
    Serial.println("\n--- Reading Sensors ---");
    
    humidity = dht.readHumidity();
    temperature = dht.readTemperature();
    
    if (isnan(humidity) || isnan(temperature)) {
        Serial.println("Failed to read DHT22!");
        humidity = -999;
        temperature = -999;
    } else {
        Serial.print("Temperature: ");
        Serial.print(temperature);
        Serial.println(" °C");
        Serial.print("Humidity: ");
        Serial.print(humidity);
        Serial.println(" %");
    }
    
    airQualityRaw = analogRead(MQ135_PIN);
    airQualityVoltage = airQualityRaw * (3.3 / 4095.0);
    
    Serial.print("Air Quality Raw: ");
    Serial.print(airQualityRaw);
    Serial.print(" | Voltage: ");
    Serial.print(airQualityVoltage, 3);
    Serial.println(" V");
    
    if (airQualityVoltage > AIR_QUALITY_THRESHOLD) {
        Serial.println("WARNING: Poor air quality detected!");
        airQualityAlert = true;
    } else {
        Serial.println("Air quality is good");
        airQualityAlert = false;
    }
    
    Serial.println("----------------------");
}

void publishToMQTT() {
    if (!mqttClient.connected()) {
        return;
    }
    
    Serial.println("\nPublishing to MQTT...");
    
    if (temperature != -999) {
        char tempStr[8];
        dtostrf(temperature, 6, 2, tempStr);
        mqttClient.publish(TOPIC_TEMPERATURE, tempStr);
        Serial.print("  Temperature: ");
        Serial.println(tempStr);
    }
    
    if (humidity != -999) {
        char humStr[8];
        dtostrf(humidity, 6, 2, humStr);
        mqttClient.publish(TOPIC_HUMIDITY, humStr);
        Serial.print("  Humidity: ");
        Serial.println(humStr);
    }
    
    char airStr[10];
    dtostrf(airQualityVoltage, 6, 3, airStr);
    mqttClient.publish(TOPIC_AIR_QUALITY, airStr);
    Serial.print("  Air Quality: ");
    Serial.println(airStr);
    
    Serial.println("MQTT publish complete\n");
}

void handleBuzzer() {
    if (airQualityAlert) {
        digitalWrite(BUZZER_PIN, HIGH);
    } else {
        digitalWrite(BUZZER_PIN, LOW);
    }
}
