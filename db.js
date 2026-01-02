const { neon } = require('@neondatabase/serverless');

// เชื่อมต่อกับ Neon Postgres
const sql = neon(process.env.DATABASE_URL);

// ฟังก์ชันสร้างตารางถ้ายังไม่มี
async function initDatabase() {
    try {
        // สร้างตาราง settings
        await sql`
            CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                shop_open BOOLEAN DEFAULT true,
                shop_name VARCHAR(255) DEFAULT 'อิหล่าปลาเผา',
                shop_phone VARCHAR(20) DEFAULT '093-549-6234',
                shop_location TEXT DEFAULT 'หน้าร้านทองเยาวราชนำโชค',
                delivery_area VARCHAR(255) DEFAULT 'ตำบลอากาศ',
                opening_hours_start VARCHAR(10) DEFAULT '09:00',
                opening_hours_end VARCHAR(10) DEFAULT '18:00',
                bank_name VARCHAR(100) DEFAULT 'กรุงไทย',
                bank_account_number VARCHAR(50) DEFAULT '4440565999',
                bank_account_name VARCHAR(255) DEFAULT 'นรารักษ์ ชารัตน์',
                admin_password VARCHAR(255) DEFAULT 'admin123',
                closed_dates TEXT DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // สร้างตาราง menu
        await sql`
            CREATE TABLE IF NOT EXISTS menu (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                price INTEGER NOT NULL,
                available BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // สร้างตาราง orders
        await sql`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                order_number VARCHAR(50) UNIQUE NOT NULL,
                customer_name VARCHAR(255) NOT NULL,
                customer_phone VARCHAR(20) NOT NULL,
                delivery_type VARCHAR(20) NOT NULL,
                delivery_time VARCHAR(20) NOT NULL,
                delivery_address TEXT,
                note TEXT,
                items JSONB NOT NULL,
                total INTEGER NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                slip_path TEXT,
                order_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // สร้าง index สำหรับ orders
        await sql`
            CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number)
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)
        `;

        console.log('✅ Database initialized successfully');

        // ตรวจสอบว่ามีข้อมูล settings หรือยัง ถ้าไม่มีให้สร้าง default
        const existingSettings = await sql`SELECT * FROM settings LIMIT 1`;
        if (existingSettings.length === 0) {
            await sql`
                INSERT INTO settings (id) VALUES (1)
            `;
            console.log('✅ Default settings created');
        }

        // ตรวจสอบว่ามีเมนูหรือยัง ถ้าไม่มีให้สร้าง default
        const existingMenu = await sql`SELECT * FROM menu LIMIT 1`;
        if (existingMenu.length === 0) {
            await sql`
                INSERT INTO menu (id, name, price) VALUES
                ('grilled-plain', 'ปลาเผา+น้ำจิ้ม', 120),
                ('grilled-veg', 'ปลาเผา+ชุดผัก+น้ำจิ้ม', 180)
            `;
            console.log('✅ Default menu created');
        }

    } catch (error) {
        console.error('❌ Error initializing database:', error);
        throw error;
    }
}

module.exports = { sql, initDatabase };
