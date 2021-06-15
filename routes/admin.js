const AdminBro = require('admin-bro')
const AdminBroExpress = require('admin-bro-expressjs');
const AdminBroMongoose = require('admin-bro-mongoose');
const Admin = require('../models/admin');
const mongoose = require('mongoose');

AdminBro.registerAdapter(AdminBroMongoose);

const adminBro = new AdminBro({
  databases: [mongoose],
  rootPath: '/adminconsole',
  branding: {
    companyName: 'Cayment',
    softwareBrothers: false
  },
})

const ADMIN = {
  email: 'jainarnav2001@gmail.com',
  password: 'password'
}

const router = AdminBroExpress.buildAuthenticatedRouter(adminBro, {
  cookieName: process.env.ADMIN_COOKIE_NAME || 'admin-bro',
  cookiePassword: process.env.ADMIN_COOKIE_PASS || 'supersecret-and-long-password-for-a-cookie-in-the-browser',
  authenticate: async (email, password) => {
    const admin = await User.findOne({email: email, password: password});
    if(admin) {
      return admin;
    } 
      return null
  }
});

module.exports = router;