import express, { Express } from 'express';
import { InstaServer } from '@root/setupServer';
import connectDatabase from '@root/setupDatabase';
import { config } from '@root/config';
import Logger from 'bunyan';

const log: Logger = config.createLogger('app');

class Application {
  public initialize(): void {
    this.loadConfig();
    connectDatabase();
    const app: Express = express();
    const server: InstaServer = new InstaServer(app);
    server.start();
    Application.handleExit();
  }

  private loadConfig(): void {
    config.validateConfig();
    config.cloudinaryConfig();
  }

  private static handleExit(): void {
    // Bắt các lỗi không được try/catch
    process.on('uncaughtException', (error: Error) => {
      log.error(`There was an uncaught error: ${error}`);
      Application.shutDownProperly(1);
    });

    // Bắt các lỗi Promise không được catch
    process.on('unhandledRejection', (reason: Error) => {
      log.error(`There was an unhandled rejection: ${reason}`);
      Application.shutDownProperly(2);
    });

    // Khi server bị kill
    process.on('SIGTERM', () => {
      log.info('Caught SIGTERM');
      Application.shutDownProperly(2);
    });

    // Khi người dùng nhấn Ctrl + C
    process.on('SIGINT', () => {
      log.info('Caught SIGNINT');
      Application.shutDownProperly(2);
    });

    // Khi process exit
    process.on('exit', () => {
      log.error('Exiting process');
    });
  }

  private static shutDownProperly(exitCode: number): void {
    Promise.resolve()
      .then(() => {
        log.info('Shutdown complete');
        process.exit(exitCode);
      })
      .catch((error: Error) => {
        log.error('Error during shutdown', error);
        process.exit(1);
      });
  }
}

const application: Application = new Application();
application.initialize();
