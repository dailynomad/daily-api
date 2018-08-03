import PubSub from '@google-cloud/pubsub';
import _ from 'lodash';
import config from './config';
import logger from './logger';
import post from './models/post';

const pubsub = new PubSub();

const topicName = 'post-image-processed';
const subName = `add-post-to-db${config.env === 'production' ? '' : `-${config.env}`}`;

const topic = pubsub.topic(topicName);
const subscription = topic.subscription(subName);

export default () => subscription.get({ autoCreate: true })
  .then(() => {
    logger.info(`waiting for messages in ${topicName}`);
    subscription.on('message', (message) => {
      const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
      logger.info(`adding post ${data.id} to db`, data);
      data.publishedAt = new Date(data.publishedAt);
      data.createdAt = new Date();
      const props = ['id', 'title', 'url', 'publicationId', 'publishedAt', 'createdAt', 'image', 'ratio', 'placeholder', 'tags', 'siteTwitter', 'creatorTwitter'];
      post.add(_.pick(data, props))
        .catch((err) => {
          if (err.code === 'ER_NO_REFERENCED_ROW_2') {
            logger.warn(`publication id ${data.publicationId} does not exist`);
          } else if (err.code === 'ER_DUP_ENTRY') {
            logger.info(`post ${data.id} already exists`);
          } else {
            throw err;
          }
        })
        .then(() => {
          logger.info(`added successfully post ${data.id}`);
          message.ack();
        });
    });
  });
