import { App, ExpressReceiver, LogLevel } from '@slack/bolt';
import { config } from '../config/environment';
import { SupabaseConfig } from '../config/supabase';
import { logger } from '../utils/logger';
import { EventHandler } from './handlers/EventHandler';
import { CommandHandler } from './handlers/CommandHandler';
import { ShuffleHandler } from './handlers/ShuffleHandler';
import { DailyHandler } from './handlers/DailyHandler';
import { SurveyHandler } from './handlers/SurveyHandler';
import { AIHandler } from './handlers/AIHandler';
import { AnalyticsHandler } from './handlers/AnalyticsHandler';
import { UserRepository } from '../repositories/UserRepository';
import { UserSyncService } from '../services/UserSyncService';
import { ScheduleManager } from '../services/ScheduleManager';

export class SlackBotApp {
  private app: App;
  private receiver: ExpressReceiver;
  private userRepository: UserRepository;
  private userSyncService: UserSyncService;
  private scheduleManager: ScheduleManager;

  constructor() {
    // Initialize Slack app with Socket Mode
    this.app = new App({
      token: config.slack.botToken,
      appToken: config.slack.appToken,
      socketMode: true, // Use Socket Mode for easier development
      logLevel: config.app.nodeEnv === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
    });

    // Create Express receiver for health check endpoint only
    this.receiver = new ExpressReceiver({
      signingSecret: config.slack.signingSecret,
      endpoints: '/slack/events', // Not used in Socket Mode, but required for health endpoint
    });

    this.userRepository = new UserRepository();
    this.userSyncService = new UserSyncService();
    this.scheduleManager = new ScheduleManager();
    this.setupHandlers();
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    // User authentication middleware
    this.app.use(async ({ context, next }) => {
      try {
        if (context.userId) {
          // Ensure user exists in database using UserSyncService
          const user = await this.userSyncService.ensureUser(context.userId);
          
          if (user) {
            // Add user to context
            context.user = user;
            logger.debug(`User context set: ${user.name} (${user.slackId})`);
          } else {
            logger.warn(`Failed to ensure user in database: ${context.userId}`);
          }
        }
        
        await next();
      } catch (error) {
        logger.error('User middleware error:', error);
        await next();
      }
    });

    logger.info('Slack app middleware registered');
  }

  private setupHandlers(): void {
    const eventHandler = new EventHandler(this.app);
    const commandHandler = new CommandHandler(this.app);
    const shuffleHandler = new ShuffleHandler(this.app);
    const dailyHandler = new DailyHandler();
    const surveyHandler = new SurveyHandler();
    const aiHandler = new AIHandler();
    const analyticsHandler = new AnalyticsHandler();

    // Register event handlers
    eventHandler.register();
    commandHandler.register();
    shuffleHandler.register();
    dailyHandler.register(this.app);
    surveyHandler.register(this.app);
    aiHandler.register(this.app);
    analyticsHandler.register(this.app);
    
    // Profile handler is registered within CommandHandler

    // Global error handler
    this.app.error(async (error) => {
      logger.error('Slack app error:', error);
      
      // Log additional context if available
      if (error.original) {
        logger.error('Original error:', error.original);
      }
    });

    // Health check endpoint
    this.receiver.router.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'slack-knowledge-hub'
      });
    });

    logger.info('Slack app handlers registered');
  }

  async start(): Promise<void> {
    try {
      // Test Supabase connection
      const isSupabaseConnected = await SupabaseConfig.testConnection();
      if (!isSupabaseConnected) {
        throw new Error('Failed to connect to Supabase');
      }

      // Test Slack API connection
      const authTest = await this.app.client.auth.test({
        token: config.slack.botToken
      });

      if (!authTest.ok) {
        throw new Error('Failed to authenticate with Slack API');
      }

      logger.info(`Authenticated as bot: ${authTest.user} in team: ${authTest.team}`);

      // Start the app (Socket Mode doesn't need port)
      await this.app.start();
      
      // Start Express server for health check endpoint
      this.receiver.start(config.app.port);
      
      // Initialize schedule manager
      this.scheduleManager.initialize();
      // Note: Shuffle scheduling will be started manually via admin commands
      
      logger.info(`Slack Knowledge Hub is running in Socket Mode`);
      logger.info(`Health check available at: http://localhost:${config.app.port}/health`);
    } catch (error) {
      logger.error('Failed to start Slack app:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.app.stop();
      logger.info('Slack Knowledge Hub stopped');
    } catch (error) {
      logger.error('Error stopping Slack app:', error);
      throw error;
    }
  }

  // Getter for testing purposes
  get slackApp(): App {
    return this.app;
  }
}