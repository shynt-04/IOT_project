# Hệ thống IoT Monitoring - ESP32 + Node.js + Web Dashboard

Hệ thống giám sát IoT với ESP32, cảm biến DHT22, MQ135, kết nối MQTT và giao diện web dashboard.

## 📋 Kiến trúc hệ thống

```
ESP32 (DHT22 + MQ135) 
    ↓ MQTT
Mosquitto Broker
    ↓ MQTT
Backend (Node.js + Express + SQLite)
    ↓ REST API
Frontend (HTML/CSS/JavaScript + Chart.js)
```

## 🔧 Cấu hình phần cứng

### Kết nối cảm biến với ESP32:
- **DHT22**: GPIO4
- **MQ135**: GPIO34 (Analog)
- **Buzzer**: GPIO25

## 🚀 Hướng dẫn cài đặt

### 1. Cài đặt Mosquitto MQTT Broker

**Windows:**
```powershell
# Download từ: https://mosquitto.org/download/
# Hoặc dùng chocolatey:
choco install mosquitto

# Khởi động service:
net start mosquitto
```

**Linux/Mac:**
```bash
sudo apt-get install mosquitto mosquitto-clients
sudo systemctl start mosquitto
sudo systemctl enable mosquitto
```

### 2. Cấu hình ESP32

1. Mở file `include/config.h`
2. Cập nhật thông tin WiFi và MQTT:
```cpp
#define WIFI_SSID "Ten_WiFi_Cua_Ban"
#define WIFI_PASSWORD "Mat_Khau_WiFi"
#define MQTT_BROKER "192.168.1.100"  // IP máy chạy Mosquitto
```

3. Build và upload code lên ESP32:
```powershell
cd e:\TaiLieuBachKhoa\IOT\project\IOT_project
pio run --target upload
pio device monitor
```

### 3. Cài đặt Backend

```powershell
cd backend

# Cài đặt dependencies
npm install

# Cấu hình file .env (đã tạo sẵn)
# Sửa MQTT_BROKER nếu cần:
# MQTT_BROKER=mqtt://localhost:1883

# Chạy server
npm start
```

Backend sẽ chạy tại: `http://localhost:3000`

### 4. Mở Frontend

**Cách 1 - Mở trực tiếp:**
```powershell
cd frontend
# Mở file index.html bằng trình duyệt
start index.html
```

**Cách 2 - Qua backend (đã config sẵn):**
Truy cập: `http://localhost:3000`

## 📊 API Endpoints

Backend cung cấp các API sau:

```
GET  /api/latest              - Lấy dữ liệu cảm biến mới nhất
GET  /api/recent/:limit       - Lấy N bản ghi gần nhất (mặc định: 100)
GET  /api/statistics/:hours   - Thống kê theo giờ (mặc định: 24h)
GET  /api/range?start=&end=   - Lấy dữ liệu theo khoảng thời gian
GET  /api/health              - Kiểm tra trạng thái server
DELETE /api/cleanup/:days     - Xóa dữ liệu cũ (mặc định: 30 ngày)
```

### Ví dụ sử dụng API:

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

## 📱 Giao diện Dashboard

Dashboard hiển thị:
- ✅ Giá trị real-time: Nhiệt độ, Độ ẩm, Chất lượng không khí
- ✅ Cảnh báo chất lượng không khí
- ✅ Thống kê 24h: Min, Max, Trung bình
- ✅ Biểu đồ theo thời gian thực
- ✅ Auto-refresh mỗi 3 giây

## 🔍 Kiểm tra hệ thống

### Test MQTT Broker:

```powershell
# Subscribe topic (terminal 1)
mosquitto_sub -h localhost -t "iot/sensor/#" -v

# Publish test message (terminal 2)
mosquitto_pub -h localhost -t "iot/sensor/temperature" -m "25.5"
```

### Test Backend:

```powershell
# Terminal 1: Chạy backend
cd backend
npm start

# Terminal 2: Test API
curl http://localhost:3000/api/health
```

### Test ESP32:

```powershell
# Xem serial monitor
pio device monitor -b 115200
```

## 📁 Cấu trúc thư mục

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

## 🛠️ Troubleshooting

### ESP32 không kết nối WiFi:
- Kiểm tra SSID và password trong `config.h`
- Đảm bảo ESP32 trong tầm WiFi
- Reset ESP32 và thử lại

### Backend không nhận MQTT:
- Kiểm tra Mosquitto đã chạy: `netstat -an | findstr 1883`
- Kiểm tra IP trong `.env` file
- Xem log: `npm start` để debug

### Frontend không hiển thị dữ liệu:
- Kiểm tra backend đã chạy: `http://localhost:3000/api/health`
- Mở Developer Console (F12) để xem lỗi
- Kiểm tra CORS settings

### Database lỗi:
- Xóa file `iot_data.db` và restart backend
- Backend sẽ tự tạo database mới

## 📝 Tính năng nâng cao (Tùy chọn)

### Thêm authentication cho MQTT:
Edit file `mosquitto.conf`:
```
allow_anonymous false
password_file /path/to/passwords
```

### Deploy lên cloud:
- Backend: Deploy lên Heroku, Railway, hoặc VPS
- MQTT: Dùng CloudMQTT hoặc HiveMQ Cloud
- Frontend: Deploy lên Netlify, Vercel, hoặc GitHub Pages

### Thêm thông báo:
- Telegram Bot
- Email alerts
- Push notifications

## 📞 Hỗ trợ

Nếu gặp vấn đề, kiểm tra:
1. Serial monitor ESP32: `pio device monitor`
2. Backend logs: Xem terminal chạy `npm start`
3. Browser console: F12 → Console tab
4. MQTT broker: `mosquitto_sub -h localhost -t "#" -v`

---

**Good luck! 🚀**
