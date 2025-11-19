import { ListSubscriptionsByTopicCommand, SetSubscriptionAttributesCommand, SNSClient, SubscribeCommand, UnsubscribeCommand, type ListSubscriptionsByTopicCommandOutput, type SubscribeCommandOutput } from "@aws-sdk/client-sns";

export const sns = new SNSClient({
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    region: process.env.AWS_REGION || "us-east-1",
});

export async function createSubscription(
    email: string,
    tickers: string[]
): Promise<void> {
    const filterPolicy = { ticker: tickers };

    const resp: SubscribeCommandOutput = await sns.send(
        new SubscribeCommand({
            TopicArn: process.env.SNS_TOPIC_ARN!,
            Protocol: "email",
            Endpoint: email,
            Attributes: {
                FilterPolicy: JSON.stringify(filterPolicy),
            },
        })
    );
}


export async function findSubscriptionArnByEmail(
    email: string
): Promise<string | null> {
    let nextToken: string | undefined = undefined;

    do {
        const resp: ListSubscriptionsByTopicCommandOutput = await sns.send(
            new ListSubscriptionsByTopicCommand({
                TopicArn: process.env.SNS_TOPIC_ARN!,
                NextToken: nextToken,
            })
        );

        const sub = resp.Subscriptions?.find(
            (s) =>
                s.Protocol === "email" &&
                s.Endpoint?.toLowerCase() === email.toLowerCase()
        );

        if (sub) {
            // Could be real ARN or "PendingConfirmation"
            return sub.SubscriptionArn ?? null;
        }

        nextToken = resp.NextToken;
    } while (nextToken);

    return null;
}

export async function updateSubscriptionFilterPolicy(
    email: string,
    tickers: string[]
): Promise<void> {
    if (tickers.length === 0) {
        tickers.push('__NO_MATCH__');
    }
    const filterPolicy = { ticker: tickers };
    const subscriptionArn = await findSubscriptionArnByEmail(email);

    if (!subscriptionArn || subscriptionArn === "PendingConfirmation") {
        throw new Error(
            `Subscription for email ${email} not found or not confirmed.`
        );
    }

    await sns.send(
        new SetSubscriptionAttributesCommand({
            SubscriptionArn: subscriptionArn,
            AttributeName: "FilterPolicy",
            AttributeValue: JSON.stringify(filterPolicy),
        })
    );
}

export async function unsubscribeAll(email: string): Promise<void> {
    await updateSubscriptionFilterPolicy(email, ['__NO_MATCH__']);
}
