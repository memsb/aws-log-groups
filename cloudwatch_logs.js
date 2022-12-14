const {
    CloudWatchLogsClient,
    DescribeLogGroupsCommand,
    DescribeLogStreamsCommand,
    ListTagsLogGroupCommand
} = require("@aws-sdk/client-cloudwatch-logs"); // CommonJS import
const date = require('date-and-time');

const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;
const client = new CloudWatchLogsClient({ region: "eu-west-1" });

const get_log_groups = async (token) => {
    const command = new DescribeLogGroupsCommand({ nextToken: token });
    const response = await client.send(command);

    if (response.nextToken) {
        return response.logGroups.concat(await get_log_groups(response.nextToken));
    } else {
        //final page
        return response.logGroups;
    }
}

const get_latest_stream = async (logGroupName) => {
    const command = new DescribeLogStreamsCommand({ logGroupName, orderBy: "LastEventTime", descending: true });
    const response = await client.send(command);
    return response.logStreams[0];
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const get_tags = async (logGroupName) => {
    const get_tags_command = new ListTagsLogGroupCommand({ logGroupName });
    const log_tags = await client.send(get_tags_command);
    return log_tags.tags;
}

const get_tag = async (logGroupName, tag) => {
    const tags = await get_tags(logGroupName);
    return tag in tags ? tags[tag] : '';
}

const get_days = async (stream) => {
    if (!stream || isNaN(stream.lastEventTimestamp)) {
        return 'never';
    }
    return Math.floor((Date.now() - stream.lastEventTimestamp) / MILLISECONDS_IN_DAY);
}

const get_date = (stream) => {
    if (!stream || isNaN(stream.lastEventTimestamp)) {
        return 'never';
    }
    return date.format(new Date(stream.lastEventTimestamp), 'DD/MM/YYYY');
}

const describe_log_groups = async (tag) => {
    const logGroups = await get_log_groups();
    const csv_headers = ['Log Group', 'Expiration Policy', 'Last Used (days)', 'Last Used', tag].join(',');

    const csv_output = [csv_headers];
    for await (const logGroup of logGroups) {
        const latest_stream = await get_latest_stream(logGroup.logGroupName);
        const logDetails = [
            logGroup.logGroupName,
            logGroup.retentionInDays || 'never',
            await get_days(latest_stream),
            get_date(latest_stream),
            await get_tag(logGroup.logGroupName, tag)
        ];
        csv_output.push(logDetails.join(','));
        await sleep(500);
    }
    console.log(csv_output.join("\n"));
}

describe_log_groups('Component');
