import mongoose from 'mongoose';
import { config } from '@root/config';

const log = config.createLogger('database');

export default () => {
  const connect = () => {
    mongoose
      .connect(config.DATABASE_URL || '')
      .then(() => {
        log.info('Successfully connected to MongoDB');
      })
      .catch((error) => {
        log.error('Error connecting to MongoDB:', error);
        return process.exit(1);
      });
  };

  connect();

  mongoose.connection.on('disconnected', connect);
};
