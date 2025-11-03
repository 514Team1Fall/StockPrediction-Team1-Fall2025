import dotenv from 'dotenv';
import { preSeed } from './db/db_api.js';
import { exit } from 'process';
dotenv.config();

preSeed().then(() => {
    console.log('Database seeding completed.');
    exit(0);
}).catch((error) => {
    console.error('Database seeding failed:', error);
    exit(1);
});
