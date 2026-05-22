// test-notifications.js
const assert = require('assert');
const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting E2E Notifications API Verification tests...');

  try {
    // 1. Log in as Admin
    console.log('\n🔑 Logging in as Admin (admin@educore.edu)...');
    const adminLogin = await request('POST', '/auth/login', {
      email: 'admin@educore.edu',
      password: 'admin123'
    });
    assert.strictEqual(adminLogin.status, 200, 'Admin login should succeed');
    const adminToken = adminLogin.body.token;
    const adminUser = adminLogin.body.user;
    console.log(`✅ Logged in as Admin: ${adminUser.name}`);

    // 2. Log in as Student
    console.log('\n🔑 Logging in as Student (student@educore.edu)...');
    const studentLogin = await request('POST', '/auth/login', {
      email: 'student@educore.edu',
      password: 'stud123'
    });
    assert.strictEqual(studentLogin.status, 200, 'Student login should succeed');
    const studentToken = studentLogin.body.token;
    const studentUser = studentLogin.body.user;
    console.log(`✅ Logged in as Student: ${studentUser.name} (ID: ${studentUser.id})`);

    // 3. Admin dispatches an announcement targeting 'students'
    console.log('\n📣 Dispatching notification to students as Admin...');
    const testTitle = 'Verification Warning Test: Term 1 Report Cards';
    const testMessage = 'All students should check their portal this Friday.';
    const postRes = await request('POST', '/notifications', {
      title: testTitle,
      message: testMessage,
      type: 'warning',
      target: 'students'
    }, { 'Authorization': `Bearer ${adminToken}` });
    assert.strictEqual(postRes.status, 201, 'Post notification should return 201');
    console.log(`✅ Notification dispatched successfully. Target count: ${postRes.body.count}`);

    // 4. Admin checks Sent History
    console.log('\n📜 Verifying Admin Sent History...');
    const sentRes = await request('GET', '/notifications/sent', null, { 'Authorization': `Bearer ${adminToken}` });
    assert.strictEqual(sentRes.status, 200, 'Sent logs should be retrievable');
    const hasSentItem = sentRes.body.some(item => item.title === testTitle);
    assert.ok(hasSentItem, 'Sent logs must contain the newly dispatched notification');
    console.log('✅ Sent History contains the dispatched notification.');

    // 5. Student checks inbox for notification
    console.log('\n📥 Verifying Student inbox contains the notification...');
    const inboxRes = await request('GET', '/notifications', null, { 'Authorization': `Bearer ${studentToken}` });
    assert.strictEqual(inboxRes.status, 200, 'Student inbox should be retrievable');
    const studentNotif = inboxRes.body.find(n => n.title === testTitle);
    assert.ok(studentNotif, 'Student must receive the notification');
    assert.strictEqual(studentNotif.type, 'warning', 'Notification type must match');
    assert.strictEqual(studentNotif.read, false, 'New notification must be unread');
    console.log(`✅ Student inbox contains the unread notification (ID: ${studentNotif.id}).`);

    // 6. Student marks notification as read
    console.log(`\n📖 Marking notification ${studentNotif.id} as read for Student...`);
    const readRes = await request('PUT', `/notifications/${studentNotif.id}/read`, null, { 'Authorization': `Bearer ${studentToken}` });
    assert.strictEqual(readRes.status, 200, 'Marking as read should return 200');

    // 7. Verify read status updated in Student inbox
    const inboxRes2 = await request('GET', '/notifications', null, { 'Authorization': `Bearer ${studentToken}` });
    const studentNotifUpdated = inboxRes2.body.find(n => n.id === studentNotif.id);
    assert.strictEqual(studentNotifUpdated.read, true, 'Notification should be marked read');
    console.log('✅ Notification read status successfully updated to true.');

    // 8. Negative Authorization test: Student tries to send a notification
    console.log('\n🛡️ Verifying security rules: Student tries to compose/send a notification...');
    const failPostRes = await request('POST', '/notifications', {
      title: 'Hacker Title',
      message: 'Hacker Message',
      type: 'info',
      target: 'all'
    }, { 'Authorization': `Bearer ${studentToken}` });
    assert.strictEqual(failPostRes.status, 403, 'Students should be forbidden (403) from sending notifications');
    console.log('✅ Security check passed: Student cannot send notifications (403 Forbidden).');

    // 9. Negative Authorization test: Student tries to check sent history
    console.log('🛡️ Verifying security rules: Student tries to view sent history...');
    const failSentRes = await request('GET', '/notifications/sent', null, { 'Authorization': `Bearer ${studentToken}` });
    assert.strictEqual(failSentRes.status, 403, 'Students should be forbidden (403) from reading sent history');
    console.log('✅ Security check passed: Student cannot read sent history (403 Forbidden).');

    console.log('\n🎉 ALL E2E NOTIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('\n❌ E2E Verification Test Failure:', err.message);
    process.exit(1);
  }
}

runTests();
