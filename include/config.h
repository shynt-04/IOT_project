#ifndef CONFIG_H
#define CONFIG_H

#define WIFI_SSID "ANM-ANVT106wifi"
#define WIFI_PASSWORD "4B&2419o"

#define MQTT_BROKER "192.168.137.1"
#define MQTT_PORT 1883
#define MQTT_USER ""
#define MQTT_PASSWORD ""
#define MQTT_CLIENT_ID "ESP32_IoT_Device"

#define TOPIC_TEMPERATURE "iot/sensor/temperature"
#define TOPIC_HUMIDITY "iot/sensor/humidity"
#define TOPIC_LIGHT "iot/sensor/light"
#define TOPIC_AIR_QUALITY "iot/sensor/airquality"
#define TOPIC_STATUS "iot/device/status"

#define DHT_PIN 4         
#define MQ135_PIN 34      
#define BUZZER_PIN 25     

#define DHT_TYPE DHT22
#define SENSOR_READ_INTERVAL 5000  
#define MQTT_PUBLISH_INTERVAL 10000 

#define AIR_QUALITY_THRESHOLD 1.9  

#endif
