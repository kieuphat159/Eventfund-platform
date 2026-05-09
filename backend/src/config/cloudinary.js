import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dns from "node:dns/promises";
import config from './env.js';

dns.setServers(["1.1.1.1", "1.0.0.1"]);

cloudinary.config({
  cloud_name: config.cloudinary.name,
  api_key: config.cloudinary.key,
  api_secret: config.cloudinary.secret,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    allowed_formats: ['jpg', 'png'],
    folder: 'uploads'
  }
});

const uploadCloud = multer({ storage });

export default uploadCloud;
