const request = require('supertest');
const app = require('../server');

describe('Health Check Endpoint', () => {
  it('should return 200 OK and status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('env');
    expect(res.body).toHaveProperty('time');
  });
});
