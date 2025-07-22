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
import { AnalyticsCommandHandler } from '../handlers/AnalyticsCommandHandler';
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
    const analyticsCommandHandler = new AnalyticsCommandHandler();

    // Add debug event listener for all events
    this.app.use(async ({ event, next }) => {
      if (event) {
        logger.info(`🔍 Event received: ${event.type}`, {
          type: event.type,
          user: (event as any).user,
          channel: (event as any).channel,
          text: (event as any).text ? (event as any).text.substring(0, 100) : undefined,
          timestamp: event.ts
        });
      }
      await next();
    });

    // Add debug hello message handler
    this.app.event('hello', async ({ event }) => {
      logger.info('👋 Hello event received from Slack', event);
    });

    // Add simple ping command for connectivity testing
    this.app.command('/ping', async ({ command, ack, respond }) => {
      await ack();
      logger.info('🏓 Ping command received from user:', command.user_id);
      
      await respond({
        text: '🏓 Pong! ボットは正常に動作しています。\n\n' +
              `• ユーザーID: ${command.user_id}\n` +
              `• チャンネルID: ${command.channel_id}\n` +
              `• タイムスタンプ: ${new Date().toISOString()}`,
        response_type: 'ephemeral'
      });
    });

    // Add simple message handler for debugging (more permissive)
    this.app.message(async ({ message, say }) => {
      try {
        const text = (message as any).text || '';
        const user = (message as any).user;
        
        // Log all messages for debugging
        logger.info('📨 Message received:', {
          text: text.substring(0, 50),
          user,
          channel: (message as any).channel,
          channel_type: (message as any).channel_type
        });
        
        // Respond to debug messages
        if (text.toLowerCase().includes('debug') || text.toLowerCase().includes('test')) {
          await say(`🐛 デバッグモード: メッセージを受信しました！\nユーザー: <@${user}>\nテキスト: "${text.substring(0, 100)}"`);
        }
      } catch (error) {
        logger.error('Error in debug message handler:', error);
      }
    });

    // Register event handlers
    eventHandler.register();
    commandHandler.register();
    shuffleHandler.register();
    dailyHandler.register(this.app);
    surveyHandler.register(this.app);
    aiHandler.register(this.app);
    analyticsHandler.register(this.app);
    analyticsCommandHandler.register(this.app);
    
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
      logger.info(`🤖 Bot details:`, {
        botName: authTest.user,
        botId: authTest.user_id,
        teamName: authTest.team,
        teamId: authTest.team_id,
        url: authTest.url
      });
      logger.info(`📝 To mention the bot, use: @${authTest.user}`);
      
      // Display available scopes for debugging
      const scopes = authTest.response_metadata?.scopes || [];
      logger.info(`🔑 Available bot scopes:`, scopes);
      
      // Check for required scopes
      const requiredScopes = ['app_mentions:read', 'chat:write', 'channels:history', 'im:history', 'commands'];
      const missingScopes = requiredScopes.filter(scope => !scopes.includes(scope));
      
      if (missingScopes.length > 0) {
        logger.warn(`⚠️  Missing required scopes:`, missingScopes);
        logger.warn('Consider adding these scopes in Slack App settings → OAuth & Permissions');
      } else {
        logger.info('✅ All required scopes are available');
      }

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