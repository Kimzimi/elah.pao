require('dotenv').config({ path: '.env.local' });

const express = require('express');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const axios = require('axios');
const fs = require('fs');
const { sql, initDatabase } = require('./db');
const app = express();

// Initialize database on startup
initDatabase().catch(console.error);

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

// Telegram Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// ตั้งค่า Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

// =============== Database Helper Functions ===============

// ฟังก์ชันดึงการตั้งค่าจาก database
async function loadSettings() {
    try {
        const result = await sql`SELECT * FROM settings WHERE id = 1 LIMIT 1`;

        if (result.length === 0) {
            // Return default settings
            return getDefaultSettings();
        }

        const row = result[0];

        // ดึงเมนูจาก database
        const menuResult = await sql`SELECT * FROM menu WHERE available = true ORDER BY id`;

        return {
            shopOpen: row.shop_open,
            shopName: row.shop_name,
            shopPhone: row.shop_phone,
            shopLocation: row.shop_location,
            deliveryArea: row.delivery_area,
            openingHours: {
                start: row.opening_hours_start,
                end: row.opening_hours_end
            },
            bankInfo: {
                bank: row.bank_name,
                accountNumber: row.bank_account_number,
                accountName: row.bank_account_name
            },
            menu: menuResult.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                enabled: item.available
            })),
            adminPassword: row.admin_password,
            closedDates: JSON.parse(row.closed_dates || '[]')
        };
    } catch (error) {
        console.error('Error loading settings from database:', error);
        return getDefaultSettings();
    }
}

function getDefaultSettings() {
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

// ฟังก์ชันบันทึกการตั้งค่าลง database
async function saveSettings(settings) {
    try {
        await sql`
            UPDATE settings SET
                shop_open = ${settings.shopOpen},
                shop_name = ${settings.shopName},
                shop_phone = ${settings.shopPhone},
                shop_location = ${settings.shopLocation},
                delivery_area = ${settings.deliveryArea},
                opening_hours_start = ${settings.openingHours.start},
                opening_hours_end = ${settings.openingHours.end},
                bank_name = ${settings.bankInfo.bank},
                bank_account_number = ${settings.bankInfo.accountNumber},
                bank_account_name = ${settings.bankInfo.accountName},
                admin_password = ${settings.adminPassword},
                closed_dates = ${JSON.stringify(settings.closedDates || [])},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        `;

        // อัพเดทเมนูถ้ามี
        if (settings.menu) {
            for (const item of settings.menu) {
                await sql`
                    INSERT INTO menu (id, name, price, available)
                    VALUES (${item.id}, ${item.name}, ${item.price}, ${item.enabled})
                    ON CONFLICT (id) DO UPDATE SET
                        name = ${item.name},
                        price = ${item.price},
                        available = ${item.enabled},
                        updated_at = CURRENT_TIMESTAMP
                `;
            }
        }

        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
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

// ฟังก์ชันส่งข้อความ Telegram
async function sendTelegramMessage(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.log('⚠️ Telegram not configured - skipping notification');
        return false;
    }

    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });

        console.log('✅ Telegram message sent successfully');
        return true;
    } catch (error) {
        console.error('❌ Error sending Telegram message:', error.message);
        return false;
    }
}

// API endpoint สำหรับรับออเดอร์
app.post('/api/send-order', upload.single('slip'), async (req, res) => {
    try {
        const orderData = JSON.parse(req.body.orderData);
        const slipFile = req.file;

        // สร้าง Order ID
        const orderId = 'ORD' + Date.now();

        // บันทึกออเดอร์ลง database (สลิปเป็น optional)
        const slipPath = slipFile ? '/uploads/' + slipFile.filename : null;

        await sql`
            INSERT INTO orders (
                order_number, customer_name, customer_phone,
                delivery_type, delivery_time, delivery_address,
                note, items, total, slip_path, order_time
            ) VALUES (
                ${orderId},
                ${orderData.customerName},
                ${orderData.customerPhone},
                ${orderData.deliveryType},
                ${orderData.deliveryTime},
                ${orderData.deliveryAddress},
                ${orderData.note || ''},
                ${JSON.stringify(orderData.items)},
                ${orderData.total},
                ${slipPath},
                ${new Date()}
            )
        `;

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
                        <a href="https://elah-pao.vercel.app/dashboard" style="display: inline-block; margin-top: 10px; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">เปิด Dashboard</a>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 20px; color: #999; font-size: 0.9em;">
                    <p>อิหล่าปลาเผา | หน้าร้านทองเยาวราชนำโชค</p>
                    <p>โทร: 093-549-6234 | ส่งฟรีในตำบลอากาศ</p>
                </div>
            </div>
        `;

        // ส่งอีเมล (แนบสลิปถ้ามี)
        const attachments = [];
        if (slipFile) {
            const slipFilePath = path.join(__dirname, 'public', 'uploads', slipFile.filename);
            attachments.push({
                filename: 'slip-' + orderId + path.extname(slipFile.filename),
                path: slipFilePath
            });
        }

        await sendEmail(
            SELLER_EMAIL,
            `🐟 ออเดอร์ใหม่ ${orderId} - ${orderData.customerName}`,
            emailHtml,
            attachments
        );

        // ส่งแจ้งเตือนทาง Telegram
        const telegramMessage = `
🐟 <b>อิหล่าปลาเผา - ออเดอร์ใหม่!</b>

📝 <b>Order ID:</b> ${orderId}
👤 <b>ชื่อ:</b> ${orderData.customerName}
📞 <b>เบอร์:</b> ${orderData.customerPhone}

🕐 <b>เวลาสั่ง:</b> ${orderData.orderTime}
⏰ <b>เวลาที่ต้องการรับ:</b> ${orderData.deliveryTime} น.

${orderData.deliveryType === 'pickup' ? '🏪 รับเองที่ร้าน' : '🚚 จัดส่ง'}
${orderData.deliveryType === 'delivery' ? `📍 <b>ที่อยู่:</b> ${orderData.deliveryAddress}` : ''}

📋 <b>รายการ:</b>
${orderData.items.map((item, i) => `${i + 1}. ${item.name} x ${item.quantity} = ${item.total} บาท`).join('\n')}

💰 <b>ยอดรวม: ${orderData.total} บาท</b>

${orderData.note ? `📝 <b>หมายเหตุ:</b> ${orderData.note}` : ''}
${slipFile ? '✅ มีสลิปแนบมาด้วย' : '⚠️ ไม่มีสลิป - ลูกค้ายืนยันชำระแล้ว'}

🔗 <a href="https://elah-pao.vercel.app/dashboard">เปิด Dashboard</a>
        `.trim();

        await sendTelegramMessage(telegramMessage);

        res.json({ success: true, message: 'ส่งออเดอร์สำเร็จ', orderId: orderId });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด: ' + error.message });
    }
});

// API สำหรับดึงรายการออเดอร์ทั้งหมด (สำหรับ Dashboard)
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await sql`
            SELECT
                id, order_number as "orderId", customer_name as "customerName",
                customer_phone as "customerPhone", delivery_type as "deliveryType",
                delivery_time as "deliveryTime", delivery_address as "deliveryAddress",
                note, items, total, status, slip_path as "slipUrl",
                order_time as "orderTime", created_at as "createdAt"
            FROM orders
            ORDER BY created_at DESC
        `;

        // แปลง items จาก JSONB string กลับเป็น object
        const formattedOrders = orders.map(order => ({
            ...order,
            items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items
        }));

        res.json(formattedOrders);
    } catch (error) {
        console.error('Error loading orders:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
});

// API สำหรับอัพเดทสถานะออเดอร์
app.post('/api/orders/:orderId/status', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        await sql`
            UPDATE orders SET
                status = ${status},
                updated_at = CURRENT_TIMESTAMP
            WHERE order_number = ${orderId}
        `;

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
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await loadSettings();

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

// Middleware ตรวจสอบ Admin Token
async function authAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'ไม่มี token' });
    }

    // ตรวจสอบ token
    const settings = await loadSettings();
    if (token === 'admin-token-' + settings.adminPassword) {
        next();
    } else {
        return res.status(403).json({ success: false, message: 'Token ไม่ถูกต้อง' });
    }
}

// API: Admin Login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { password } = req.body;
        const settings = await loadSettings();

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
app.get('/api/admin/settings', authAdmin, async (req, res) => {
    try {
        const settings = await loadSettings();
        // ไม่ส่ง password กลับไป
        delete settings.adminPassword;
        res.json(settings);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
});

// API: Update Settings
app.post('/api/admin/settings', authAdmin, async (req, res) => {
    try {
        const updates = req.body;
        const settings = await loadSettings();

        // Merge updates
        Object.keys(updates).forEach(key => {
            settings[key] = updates[key];
        });

        await saveSettings(settings);

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
    console.log(`💾 Database: ${process.env.DATABASE_URL ? 'Neon Postgres ✅' : 'Not configured ⚠️'}`);
});
