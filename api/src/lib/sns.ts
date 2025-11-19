import { SetSubscriptionAttributesCommand, SNSClient, SubscribeCommand, UnsubscribeCommand, type SubscribeCommandOutput } from "@aws-sdk/client-sns";

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
): Promise<string> {
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

    // Could be actual ARN or "PendingConfirmation"
    return resp.SubscriptionArn!;
}

export async function updateSubscriptionFilterPolicy(
    subscriptionArn: string,
    tickers: string[]
): Promise<void> {
    const filterPolicy = { ticker: tickers };

    await sns.send(
        new SetSubscriptionAttributesCommand({
            SubscriptionArn: subscriptionArn,
            AttributeName: "FilterPolicy",
            AttributeValue: JSON.stringify(filterPolicy),
        })
    );
}

export async function unsubscribeAll(subscriptionArn: string): Promise<void> {
    await sns.send(
        new UnsubscribeCommand({
            SubscriptionArn: subscriptionArn,
        })
    );
}
