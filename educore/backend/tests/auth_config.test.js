const request = require('supertest');
const app = require('../server');

describe('Auth Config and Demo Login Restriction', () => {
  let originalEnv;

  beforeAll(() => {
    originalEnv = process.env.APP_ENV;
  });

  afterEach(() => {
    process.env.APP_ENV = originalEnv;
  });

  it('should return appEnv as development by default', async () => {
    process.env.APP_ENV = 'development';
    const res = await request(app).get('/api/auth/config');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('appEnv', 'development');
  });

  it('should return appEnv as production when set', async () => {
    process.env.APP_ENV = 'production';
    const res = await request(app).get('/api/auth/config');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('appEnv', 'production');
  });

  it('should block demo logins in production mode', async () => {
    process.env.APP_ENV = 'production';
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@educore.edu', password: 'some-password' });
    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('error', 'Demo accounts are disabled in production mode');
  });
});
