import { ConnectorClient, MicrosoftAppCredentials, Models } from 'botframework-connector';
import { BotAuthenticator } from 'botframework-connector-auth';
import * as restify from "restify";

const credentials = new MicrosoftAppCredentials({
    appId: '',
    appPassword: ''
});

const authenticator = new BotAuthenticator();

const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log(`${server.name} listening to ${server.url}`);
});

server.post('/api/messages', getListener());

function getListener(): HttpHandler {
    // handle activity when request body is ready
    function processReq(req, res) {
        console.log('processReq:', req.body);

        var activity = req.body;

        // authenticate request
        authenticator.authenticate(req.headers, activity.channelId, activity.serviceUrl).then(() => {

            // On message activity, reply with the same text
            if (activity.type === 'message') {
                var reply = createReply(activity, `You said: ${activity.text}`);
                const client = new ConnectorClient(credentials, activity.serviceUrl);
                client.conversations.replyToActivity(activity.conversation.id, activity.id, reply)
                    .then((reply) => {
                        console.log('reply send with id: ' + reply.id);
                    });
            }

            res.send(202);
        }).catch(err => {
            console.log('Could not authenticate request:', err);
            res.send(401);
        });
    }

    // support streamed and chuncked responses
    return (req, res) => {
        if (req.body) {
            processReq(req, res);
        } else {
            let requestData = '';
            req.on('data', (chunk: string) => {
                requestData += chunk
            });
            req.on('end', () => {
                req.body = JSON.parse(requestData);
                processReq(req, res);
            });
        }
    };
}

export interface HttpHandler {
    (req, res, next?: Function): void;
}

function createReply(activity: any, text: string, locale: string = null): Models.Activity {
    let reply = new Models.Activity();
    reply.type = "message";
    reply.timestamp = new Date();
    reply.from = { id: activity.recipient.id, name: activity.recipient.name };
    reply.recipient = { id: activity.from.id, name: activity.from.name };
    reply.replyToId = activity.id;
    reply.serviceUrl = activity.serviceUrl;
    reply.channelId = activity.channelId;
    reply.conversation = { isGroup: activity.conversation.isGroup, id: activity.conversation.id, name: activity.conversation.name };
    reply.text = text || '';
    reply.locale = locale || activity.locale;
    return reply;
}