# Hệ thống Environment Monitoring

TODO...

## Kiến trúc hệ thống


## Cấu hình phần cứng

### Kết nối cảm biến với ESP32:
- **DHT22**: GPIO4
- **MQ135**: GPIO34 (Analog)
- **Buzzer**: GPIO25

## Hướng dẫn cài đặt

### 1. Cài đặt Mosquitto MQTT Broker

**Windows:**
```powershell
# Download từ: https://mosquitto.org/download/
net start mosquitto
```

`Note: phải tạo rule mở port 1883`

### 2. Cấu hình ESP32

1. Mở file `include/config.h`
2. Cập nhật thông tin:
```cpp
#define WIFI_SSID "Ten_WiFi"
#define WIFI_PASSWORD "Mat_Khau_WiFi"
#define MQTT_BROKER "192.168.1.100"
```

3. Build và upload code lên ESP32 (Build > Upload > Monitor)

### 3. Backend

```powershell
cd backend
npm install
npm start
```

BE + FE URL: `http://localhost:3000`

## API Endpoints

Backend API:

```
GET  /api/latest              - Lấy dữ liệu cảm biến mới nhất
GET  /api/recent/:limit       - Lấy N bản ghi gần nhất (mặc định: 100)
GET  /api/statistics/:hours   - Thống kê theo giờ (mặc định: 24h)
GET  /api/range?start=&end=   - Lấy dữ liệu theo khoảng thời gian
GET  /api/health              - Kiểm tra trạng thái server
DELETE /api/cleanup/:days     - Xóa dữ liệu cũ (mặc định: 30 ngày)
```

### API Usage:

```powershell
# Lấy dữ liệu mới nhất
curl http://localhost:3000/api/latest

# Lấy 50 bản ghi gần nhất
curl http://localhost:3000/api/recent/50

# Thống kê 12 giờ qua
curl http://localhost:3000/api/statistics/12

# Kiểm tra health
curl http://localhost:3000/api/health
```

## Cấu trúc thư mục

```
IOT_project/
├── src/
│   └── main.cpp              # Code ESP32
├── include/
│   └── config.h              # Cấu hình WiFi & MQTT
├── backend/
│   ├── server.js             # Backend server
│   ├── database.js           # SQLite database manager
│   ├── package.json          # Dependencies
│   ├── .env                  # Cấu hình backend
│   └── iot_data.db          # Database (tự động tạo)
├── frontend/
│   ├── index.html            # Giao diện dashboard
│   ├── style.css             # CSS styling
│   └── app.js                # Frontend logic
└── platformio.ini            # PlatformIO config
```

