const { express, cors, dotenv } = require('./libraries');

function createApp() {
  dotenv.config();
  const app = express();
  app.use(cors());
  app.use(express.json());
  return app;
}

module.exports = {
  createApp,
};
