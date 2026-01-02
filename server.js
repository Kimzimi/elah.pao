const express = require('express');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));
app.use('/assets', express.static('assets'));

// ตั้งค่า Multer สำหรับอัพโหลดไฟล์
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'slip-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Email Configuration
const EMAIL_USER = 'elah.pao@gmail.com';
const EMAIL_PASS = 'lunt pjfa xlrb wunj';
const SELLER_EMAIL = 'elah.pao@gmail.com';    // อีเมลผู้ขาย (รับการแจ้งเตือน)

// ตั้งค่า Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

// ฟังก์ชันโหลดออเดอร์จากไฟล์
function loadOrders() {
    try {
        if (fs.existsSync('data/orders.json')) {
            const data = fs.readFileSync('data/orders.json', 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
    return [];
}

// ฟังก์ชันบันทึกออเดอร์ลงไฟล์
function saveOrders(orders) {
    try {
        fs.writeFileSync('data/orders.json', JSON.stringify(orders, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving orders:', error);
        return false;
    }
}

// ฟังก์ชันส่งอีเมล
async function sendEmail(to, subject, html, attachments = []) {
    try {
        const mailOptions = {
            from: `"อิหล่าปลาเผา" <${EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: html,
            attachments: attachments
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

// API endpoint สำหรับรับออเดอร์
app.post('/api/send-order', upload.single('slip'), async (req, res) => {
    try {
        const orderData = JSON.parse(req.body.orderData);
        const slipFile = req.file;

        if (!slipFile) {
            return res.status(400).json({ success: false, message: 'กรุณาแนบสลิปการโอนเงิน' });
        }

        // สร้าง Order ID
        const orderId = 'ORD' + Date.now();

        // สร้างข้อมูลออเดอร์ฉบับเต็ม
        const fullOrder = {
            orderId: orderId,
            ...orderData,
            slipUrl: '/uploads/' + slipFile.filename,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // บันทึกออเดอร์ลงไฟล์
        const orders = loadOrders();
        orders.push(fullOrder);
        saveOrders(orders);

        // สร้าง HTML สำหรับอีเมล
        const deliveryTypeText = orderData.deliveryType === 'pickup' ? '🏪 รับเองที่ร้าน' : '🚚 จัดส่ง';

        let emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">
                    <h1 style="margin: 0;">🐟 อิหล่าปลาเผา</h1>
                    <h2 style="margin: 10px 0 0 0;">ออเดอร์ใหม่!</h2>
                </div>

                <div style="background: white; padding: 30px; border-radius: 10px; margin-top: 20px;">
                    <h3 style="color: #667eea; margin-top: 0;">📝 รายละเอียดออเดอร์</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 10px 0; color: #666;">Order ID:</td>
                            <td style="padding: 10px 0; font-weight: bold;">${orderId}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 10px 0; color: #666;">เวลาสั่ง:</td>
                            <td style="padding: 10px 0;">${orderData.orderTime}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 10px 0; color: #666;">เวลาที่ต้องการรับ:</td>
                            <td style="padding: 10px 0; font-weight: bold; color: #f5576c;">${orderData.deliveryTime} น.</td>
                        </tr>
                    </table>

                    <h3 style="color: #667eea; margin-top: 30px;">👤 ข้อมูลลูกค้า</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 10px 0; color: #666;">ชื่อ:</td>
                            <td style="padding: 10px 0; font-weight: bold;">${orderData.customerName}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 10px 0; color: #666;">เบอร์โทร:</td>
                            <td style="padding: 10px 0; font-weight: bold;">${orderData.customerPhone}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 10px 0; color: #666;">วิธีรับสินค้า:</td>
                            <td style="padding: 10px 0;">${deliveryTypeText}</td>
                        </tr>
                        ${orderData.deliveryType === 'delivery' ? `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 10px 0; color: #666;">ที่อยู่:</td>
                            <td style="padding: 10px 0;">${orderData.deliveryAddress}</td>
                        </tr>
                        ` : ''}
                        ${orderData.note ? `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 10px 0; color: #666;">หมายเหตุ:</td>
                            <td style="padding: 10px 0;">${orderData.note}</td>
                        </tr>
                        ` : ''}
                    </table>

                    <h3 style="color: #667eea; margin-top: 30px;">📋 รายการสั่งซื้อ</h3>
                    <table style="width: 100%; border-collapse: collapse; background: #f8f9fa; padding: 15px; border-radius: 5px;">
        `;

        orderData.items.forEach((item, index) => {
            emailHtml += `
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 10px;">${index + 1}. ${item.name} x ${item.quantity}</td>
                            <td style="padding: 10px; text-align: right; font-weight: bold;">${item.total} บาท</td>
                        </tr>
            `;
        });

        emailHtml += `
                        <tr style="background: #fff3cd;">
                            <td style="padding: 15px; font-weight: bold; font-size: 1.2em;">ยอดรวมทั้งหมด:</td>
                            <td style="padding: 15px; text-align: right; font-weight: bold; font-size: 1.2em; color: #667eea;">${orderData.total} บาท</td>
                        </tr>
                    </table>

                    <div style="margin-top: 30px; padding: 20px; background: #d4edda; border-radius: 5px; border-left: 4px solid #28a745;">
                        <p style="margin: 0; color: #155724; font-weight: bold;">✅ รอการยืนยันออเดอร์</p>
                        <p style="margin: 10px 0 0 0; color: #155724;">กรุณาตรวจสอบสลิปการโอนเงินที่แนบมาด้วย</p>
                    </div>

                    <div style="margin-top: 20px; text-align: center; padding: 20px; background: #f0f8ff; border-radius: 5px;">
                        <p style="margin: 0; color: #666;">เข้าสู่ Dashboard เพื่อจัดการออเดอร์</p>
                        <a href="http://localhost:3000/dashboard" style="display: inline-block; margin-top: 10px; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">เปิด Dashboard</a>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 20px; color: #999; font-size: 0.9em;">
                    <p>อิหล่าปลาเผา | หน้าร้านทองเยาวราชนำโชค</p>
                    <p>โทร: 093-549-6234 | ส่งฟรีในตำบลอากาศ</p>
                </div>
            </div>
        `;

        // ส่งอีเมลพร้อมแนบสลิป
        const slipPath = path.join(__dirname, 'public', 'uploads', slipFile.filename);
        await sendEmail(
            SELLER_EMAIL,
            `🐟 ออเดอร์ใหม่ ${orderId} - ${orderData.customerName}`,
            emailHtml,
            [
                {
                    filename: 'slip-' + orderId + path.extname(slipFile.filename),
                    path: slipPath
                }
            ]
        );

        res.json({ success: true, message: 'ส่งออเดอร์สำเร็จ', orderId: orderId });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด: ' + error.message });
    }
});

// API สำหรับดึงรายการออเดอร์ทั้งหมด (สำหรับ Dashboard)
app.get('/api/orders', (req, res) => {
    const orders = loadOrders();
    res.json(orders.reverse());
});

// API สำหรับอัพเดทสถานะออเดอร์
app.post('/api/orders/:orderId/status', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const orders = loadOrders();
        const orderIndex = orders.findIndex(o => o.orderId === orderId);

        if (orderIndex === -1) {
            return res.status(404).json({ success: false, message: 'ไม่พบออเดอร์' });
        }

        orders[orderIndex].status = status;
        orders[orderIndex].updatedAt = new Date().toISOString();

        saveOrders(orders);

        // ไม่ส่งอีเมลแจ้งเตือนลูกค้า (ตามที่ร้องขอ - แจ้งเฉพาะผู้ขายตอนสั่งซื้อ)

        res.json({ success: true, message: 'อัพเดทสถานะสำเร็จ' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
});

// Route หลัก
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// หน้า Dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// =============== Public API ===============

// ฟังก์ชันตรวจสอบว่าร้านเปิดหรือไม่ตามเวลา
function isShopOpenByTime(settings) {
    // ใช้เวลาไทย (UTC+7)
    const now = new Date();
    const thaiTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

    // ตรวจสอบวันหยุดพิเศษ
    const currentDate = thaiTime.toISOString().split('T')[0]; // YYYY-MM-DD
    if (settings.closedDates && settings.closedDates.includes(currentDate)) {
        return false; // ปิดในวันหยุดพิเศษ
    }

    const currentHour = thaiTime.getHours();
    const currentMinute = thaiTime.getMinutes();
    const currentTime = currentHour * 60 + currentMinute; // แปลงเป็นนาที

    // แปลงเวลาเปิด-ปิดเป็นนาที
    const [openHour, openMinute] = settings.openingHours.start.split(':').map(Number);
    const [closeHour, closeMinute] = settings.openingHours.end.split(':').map(Number);

    const openTime = openHour * 60 + openMinute;
    const closeTime = closeHour * 60 + closeMinute;

    // ตรวจสอบว่าเวลาปัจจุบันอยู่ในช่วงเปิดหรือไม่
    return currentTime >= openTime && currentTime < closeTime;
}

// API: Get public settings (shop status and menu)
app.get('/api/settings', (req, res) => {
    try {
        const settings = loadSettings();

        // ตรวจสอบว่าร้านเปิดตามเวลาหรือไม่
        const isOpen = isShopOpenByTime(settings);

        res.json({
            shopOpen: isOpen,
            shopName: settings.shopName,
            menu: settings.menu.filter(item => item.enabled),
            openingHours: settings.openingHours
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
});

// =============== Admin System ===============

// ฟังก์ชันโหลดการตั้งค่า
function loadSettings() {
    try {
        if (fs.existsSync('data/settings.json')) {
            const data = fs.readFileSync('data/settings.json', 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
    // ค่า default
    return {
        shopOpen: true,
        shopName: "อิหล่าปลาเผา",
        shopPhone: "093-549-6234",
        shopLocation: "หน้าร้านทองเยาวราชนำโชค",
        deliveryArea: "ตำบลอากาศ",
        openingHours: {
            start: "09:00",
            end: "18:00"
        },
        bankInfo: {
            bank: "กรุงไทย",
            accountNumber: "4440565999",
            accountName: "นรารักษ์ ชารัตน์"
        },
        menu: [
            {
                id: "grilled-plain",
                name: "ปลาเผา+น้ำจิ้ม",
                price: 120,
                enabled: true
            },
            {
                id: "grilled-veg",
                name: "ปลาเผา+ชุดผัก+น้ำจิ้ม",
                price: 180,
                enabled: true
            }
        ],
        adminPassword: "admin123",
        closedDates: []
    };
}

// ฟังก์ชันบันทึกการตั้งค่า
function saveSettings(settings) {
    try {
        // สร้างโฟลเดอร์ data ถ้ายังไม่มี
        if (!fs.existsSync('data')) {
            fs.mkdirSync('data');
        }
        fs.writeFileSync('data/settings.json', JSON.stringify(settings, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

// Middleware ตรวจสอบ Admin Token
function authAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'ไม่มี token' });
    }

    // ตรวจสอบ token (ในที่นี้ใช้วิธีง่ายๆ)
    if (token === 'admin-token-' + loadSettings().adminPassword) {
        next();
    } else {
        return res.status(403).json({ success: false, message: 'Token ไม่ถูกต้อง' });
    }
}

// API: Admin Login
app.post('/api/admin/login', (req, res) => {
    try {
        const { password } = req.body;
        const settings = loadSettings();

        if (password === settings.adminPassword) {
            // สร้าง token
            const token = 'admin-token-' + settings.adminPassword;
            res.json({
                success: true,
                token: token,
                message: 'เข้าสู่ระบบสำเร็จ'
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'รหัสผ่านไม่ถูกต้อง'
            });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
});

// API: Get Settings
app.get('/api/admin/settings', authAdmin, (req, res) => {
    try {
        const settings = loadSettings();
        // ไม่ส่ง password กลับไป
        delete settings.adminPassword;
        res.json(settings);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
});

// API: Update Settings
app.post('/api/admin/settings', authAdmin, (req, res) => {
    try {
        const updates = req.body;
        const settings = loadSettings();

        // Merge updates
        Object.keys(updates).forEach(key => {
            settings[key] = updates[key];
        });

        saveSettings(settings);

        res.json({ success: true, message: 'บันทึกสำเร็จ' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
});

// ตั้งค่า Multer สำหรับอัพโหลด QR
const qrStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'assets/');
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        cb(null, 'qr-payment' + ext);
    }
});

const uploadQR = multer({ storage: qrStorage });

// API: Upload QR Code
app.post('/api/admin/upload-qr', authAdmin, uploadQR.single('qr'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'ไม่มีไฟล์' });
        }

        const ext = path.extname(req.file.originalname);
        res.json({
            success: true,
            message: 'อัพโหลดสำเร็จ',
            qrPath: '/assets/qr-payment' + ext
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
});

// หน้า Admin Login
app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// หน้า Admin Panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// เริ่มเซิร์ฟเวอร์
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📱 เปิดเว็บได้ที่ http://localhost:${PORT}`);
    console.log(`🎛️ Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`📧 อีเมลแจ้งเตือน: ${SELLER_EMAIL}`);
});
