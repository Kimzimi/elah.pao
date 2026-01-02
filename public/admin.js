// ตรวจสอบ Token
function checkAuth() {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = '/admin-login';
        return false;
    }
    return true;
}

// เรียกใช้ checkAuth เมื่อโหลดหน้า
if (!checkAuth()) {
    // หยุดการทำงาน
}

// ฟังก์ชัน Logout
function logout() {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin-login';
}

// ฟังก์ชันสลับ Tab
function switchTab(tabName) {
    // ซ่อนทุก tab
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    // ลบ active จากปุ่ม tab
    const tabButtons = document.querySelectorAll('.tab');
    tabButtons.forEach(btn => btn.classList.remove('active'));

    // แสดง tab ที่เลือก
    document.getElementById('tab-' + tabName).classList.add('active');
    event.target.classList.add('active');
}

// ฟังก์ชันแสดง Alert
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';

    alertContainer.innerHTML = `
        <div class="alert ${alertClass}">
            ${message}
        </div>
    `;

    // ลบ alert หลัง 5 วินาที
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// โหลดข้อมูลตั้งค่าทั้งหมด
async function loadSettings() {
    try {
        // โหลดสถานะร้านปัจจุบัน (จาก API สาธารณะ)
        const publicResponse = await fetch('/api/settings');
        const publicSettings = await publicResponse.json();

        // แสดงสถานะร้านปัจจุบัน
        const autoStatus = document.getElementById('shop-auto-status');
        if (publicSettings.shopOpen) {
            autoStatus.innerHTML = '🟢 <strong>เปิดร้าน</strong> (เวลา ' + publicSettings.openingHours.start + ' - ' + publicSettings.openingHours.end + ' น.)';
            autoStatus.style.color = '#fff';
        } else {
            autoStatus.innerHTML = '🔴 <strong>ปิดร้าน</strong> (เปิด ' + publicSettings.openingHours.start + ' - ' + publicSettings.openingHours.end + ' น.)';
            autoStatus.style.color = '#ffcccc';
        }

        // โหลดข้อมูลการตั้งค่าสำหรับ Admin
        const response = await fetch('/api/admin/settings', {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            }
        });

        if (!response.ok) {
            throw new Error('ไม่สามารถโหลดข้อมูลได้');
        }

        const settings = await response.json();

        // อัพเดทข้อมูลร้าน
        document.getElementById('shop-name').value = settings.shopName || '';
        document.getElementById('shop-phone').value = settings.shopPhone || '';
        document.getElementById('shop-location').value = settings.shopLocation || '';
        document.getElementById('delivery-area').value = settings.deliveryArea || '';
        document.getElementById('opening-time').value = settings.openingHours?.start || '';
        document.getElementById('closing-time').value = settings.openingHours?.end || '';

        // อัพเดทข้อมูลบัญชี
        document.getElementById('bank-name').value = settings.bankInfo?.bank || '';
        document.getElementById('bank-account').value = settings.bankInfo?.accountNumber || '';
        document.getElementById('bank-holder').value = settings.bankInfo?.accountName || '';

        // อัพเดท QR Code
        document.getElementById('current-qr').src = '/assets/qr-payment.jpg';

        // โหลดเมนู
        loadMenu(settings.menu || []);

        // โหลดวันหยุดพิเศษ
        loadClosedDates(settings.closedDates || []);

    } catch (error) {
        console.error('Error loading settings:', error);
        showAlert('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'danger');
    }
}

// โหลดเมนู
function loadMenu(menuItems) {
    const menuList = document.getElementById('menu-list');
    menuList.innerHTML = '';

    menuItems.forEach((item, index) => {
        menuList.innerHTML += `
            <div class="menu-item-card" data-index="${index}">
                <div class="menu-item-header">
                    <h3>${item.name}</h3>
                    <label class="switch">
                        <input type="checkbox" ${item.enabled ? 'checked' : ''}
                               onchange="toggleMenuItem(${index})">
                        <span class="slider"></span>
                    </label>
                </div>
                <p style="color: #666;">ราคา: ${item.price} บาท</p>
                <div style="margin-top: 10px; display: flex; gap: 10px;">
                    <button class="btn btn-primary" onclick="editMenuItem(${index})">แก้ไข</button>
                    <button class="btn btn-danger" onclick="deleteMenuItem(${index})">ลบ</button>
                </div>
            </div>
        `;
    });
}

// เปิด/ปิดเมนู
async function toggleMenuItem(index) {
    try {
        const response = await fetch('/api/admin/settings', {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            }
        });
        const settings = await response.json();

        settings.menu[index].enabled = !settings.menu[index].enabled;

        await fetch('/api/admin/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: JSON.stringify({ menu: settings.menu })
        });

        showAlert('อัพเดทสถานะเมนูสำเร็จ', 'success');
    } catch (error) {
        console.error('Error:', error);
        showAlert('เกิดข้อผิดพลาด', 'danger');
    }
}

// แก้ไขเมนู
async function editMenuItem(index) {
    try {
        const response = await fetch('/api/admin/settings', {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            }
        });
        const settings = await response.json();
        const item = settings.menu[index];

        const newName = prompt('ชื่อเมนู:', item.name);
        if (newName === null) return;

        const newPrice = prompt('ราคา:', item.price);
        if (newPrice === null) return;

        settings.menu[index].name = newName;
        settings.menu[index].price = parseInt(newPrice);

        await fetch('/api/admin/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: JSON.stringify({ menu: settings.menu })
        });

        loadSettings();
        showAlert('แก้ไขเมนูสำเร็จ', 'success');
    } catch (error) {
        console.error('Error:', error);
        showAlert('เกิดข้อผิดพลาด', 'danger');
    }
}

// ลบเมนู
async function deleteMenuItem(index) {
    if (!confirm('ต้องการลบเมนูนี้หรือไม่?')) return;

    try {
        const response = await fetch('/api/admin/settings', {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            }
        });
        const settings = await response.json();

        settings.menu.splice(index, 1);

        await fetch('/api/admin/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: JSON.stringify({ menu: settings.menu })
        });

        loadSettings();
        showAlert('ลบเมนูสำเร็จ', 'success');
    } catch (error) {
        console.error('Error:', error);
        showAlert('เกิดข้อผิดพลาด', 'danger');
    }
}

// เพิ่มเมนูใหม่
async function addNewMenu() {
    const name = prompt('ชื่อเมนู:');
    if (!name) return;

    const price = prompt('ราคา:');
    if (!price) return;

    try {
        const response = await fetch('/api/admin/settings', {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            }
        });
        const settings = await response.json();

        const newItem = {
            id: 'menu-' + Date.now(),
            name: name,
            price: parseInt(price),
            enabled: true
        };

        settings.menu.push(newItem);

        await fetch('/api/admin/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: JSON.stringify({ menu: settings.menu })
        });

        loadSettings();
        showAlert('เพิ่มเมนูสำเร็จ', 'success');
    } catch (error) {
        console.error('Error:', error);
        showAlert('เกิดข้อผิดพลาด', 'danger');
    }
}

// อัพโหลด QR Code
async function uploadQRCode() {
    const fileInput = document.getElementById('qr-upload');
    const file = fileInput.files[0];

    if (!file) {
        showAlert('กรุณาเลือกไฟล์', 'danger');
        return;
    }

    if (!file.type.startsWith('image/')) {
        showAlert('กรุณาเลือกไฟล์รูปภาพ', 'danger');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('qr', file);

        const response = await fetch('/api/admin/upload-qr', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error('ไม่สามารถอัพโหลดได้');
        }

        const result = await response.json();

        // รีโหลดรูป QR
        document.getElementById('current-qr').src = result.qrPath + '?t=' + Date.now();
        fileInput.value = '';

        showAlert('อัพโหลด QR Code สำเร็จ', 'success');
    } catch (error) {
        console.error('Error:', error);
        showAlert('เกิดข้อผิดพลาด', 'danger');
    }
}

// บันทึกข้อมูลบัญชี
async function saveBankInfo() {
    const bank = document.getElementById('bank-name').value;
    const accountNumber = document.getElementById('bank-account').value;
    const accountName = document.getElementById('bank-holder').value;

    if (!bank || !accountNumber || !accountName) {
        showAlert('กรุณากรอกข้อมูลให้ครบถ้วน', 'danger');
        return;
    }

    try {
        await fetch('/api/admin/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: JSON.stringify({
                bankInfo: {
                    bank: bank,
                    accountNumber: accountNumber,
                    accountName: accountName
                }
            })
        });

        showAlert('บันทึกข้อมูลบัญชีสำเร็จ', 'success');
    } catch (error) {
        console.error('Error:', error);
        showAlert('เกิดข้อผิดพลาด', 'danger');
    }
}

// บันทึกข้อมูลร้าน
async function saveShopInfo() {
    const shopName = document.getElementById('shop-name').value;
    const shopPhone = document.getElementById('shop-phone').value;
    const shopLocation = document.getElementById('shop-location').value;
    const deliveryArea = document.getElementById('delivery-area').value;
    const openingTime = document.getElementById('opening-time').value;
    const closingTime = document.getElementById('closing-time').value;

    if (!shopName || !shopPhone || !shopLocation || !deliveryArea || !openingTime || !closingTime) {
        showAlert('กรุณากรอกข้อมูลให้ครบถ้วน', 'danger');
        return;
    }

    try {
        await fetch('/api/admin/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: JSON.stringify({
                shopName: shopName,
                shopPhone: shopPhone,
                shopLocation: shopLocation,
                deliveryArea: deliveryArea,
                openingHours: {
                    start: openingTime,
                    end: closingTime
                }
            })
        });

        showAlert('บันทึกข้อมูลร้านสำเร็จ', 'success');
    } catch (error) {
        console.error('Error:', error);
        showAlert('เกิดข้อผิดพลาด', 'danger');
    }
}

// เปลี่ยนรหัสผ่าน
async function changePassword() {
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!newPassword || !confirmPassword) {
        showAlert('กรุณากรอกรหัสผ่านให้ครบถ้วน', 'danger');
        return;
    }

    if (newPassword !== confirmPassword) {
        showAlert('รหัสผ่านไม่ตรงกัน', 'danger');
        return;
    }

    if (newPassword.length < 6) {
        showAlert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'danger');
        return;
    }

    try {
        await fetch('/api/admin/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: JSON.stringify({
                adminPassword: newPassword
            })
        });

        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';

        showAlert('เปลี่ยนรหัสผ่านสำเร็จ', 'success');
    } catch (error) {
        console.error('Error:', error);
        showAlert('เกิดข้อผิดพลาด', 'danger');
    }
}

// โหลดวันหยุดพิเศษ
function loadClosedDates(closedDates) {
    const list = document.getElementById('closed-dates-list');
    if (!list) return;

    if (!closedDates || closedDates.length === 0) {
        list.innerHTML = '<p style="color: #999; font-style: italic;">ยังไม่มีวันหยุดพิเศษ</p>';
        return;
    }

    list.innerHTML = closedDates.map(date => {
        const thaiDate = new Date(date + 'T00:00:00').toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        return `
            <div style="display: flex; justify-content: space-between; align-items: center;
                        padding: 10px; background: #f8f9fa; border-radius: 5px; margin-bottom: 5px;">
                <span>📅 ${thaiDate}</span>
                <button class="btn btn-danger" onclick="removeClosedDate('${date}')" style="padding: 5px 15px;">ลบ</button>
            </div>
        `;
    }).join('');
}

// เพิ่มวันหยุดพิเศษ
async function addClosedDates() {
    const startDate = document.getElementById('closed-start-date').value;
    const endDate = document.getElementById('closed-end-date').value;

    if (!startDate) {
        showAlert('กรุณาเลือกวันที่', 'danger');
        return;
    }

    try {
        const response = await fetch('/api/admin/settings', {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            }
        });
        const settings = await response.json();

        let closedDates = settings.closedDates || [];

        // สร้างรายการวันที่
        if (endDate && endDate >= startDate) {
            // มีวันที่สิ้นสุด - สร้างช่วงวันที่
            const start = new Date(startDate + 'T00:00:00');
            const end = new Date(endDate + 'T00:00:00');

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().split('T')[0];
                if (!closedDates.includes(dateStr)) {
                    closedDates.push(dateStr);
                }
            }
        } else {
            // วันเดียว
            if (!closedDates.includes(startDate)) {
                closedDates.push(startDate);
            }
        }

        // เรียงตามวันที่
        closedDates.sort();

        await fetch('/api/admin/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: JSON.stringify({ closedDates: closedDates })
        });

        // ล้างฟอร์ม
        document.getElementById('closed-start-date').value = '';
        document.getElementById('closed-end-date').value = '';

        loadSettings();
        showAlert('เพิ่มวันหยุดพิเศษสำเร็จ', 'success');
    } catch (error) {
        console.error('Error:', error);
        showAlert('เกิดข้อผิดพลาด', 'danger');
    }
}

// ลบวันหยุดพิเศษ
async function removeClosedDate(date) {
    if (!confirm('ต้องการลบวันหยุดนี้หรือไม่?')) return;

    try {
        const response = await fetch('/api/admin/settings', {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            }
        });
        const settings = await response.json();

        let closedDates = settings.closedDates || [];
        closedDates = closedDates.filter(d => d !== date);

        await fetch('/api/admin/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('adminToken')
            },
            body: JSON.stringify({ closedDates: closedDates })
        });

        loadSettings();
        showAlert('ลบวันหยุดพิเศษสำเร็จ', 'success');
    } catch (error) {
        console.error('Error:', error);
        showAlert('เกิดข้อผิดพลาด', 'danger');
    }
}

// โหลดข้อมูลเมื่อหน้าโหลดเสร็จ
window.addEventListener('load', () => {
    loadSettings();
});
