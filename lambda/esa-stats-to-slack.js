const https = require('https');
const AWS = require('aws-sdk');

const callEsaApi = async (url, token) => {
    return new Promise((resolve, reject) => {
        https.get(`https://api.esa.io/v1/${url}?access_token=${token}`, (resp) => {

            let data = '';
            resp.on('data', chunk => { data += chunk; });
            resp.on('end', () => resolve(JSON.parse(data)));
        }).on('error', err => reject(err));
    });
};

const getTeams = async (param) => {
    const ret = await callEsaApi('/teams', param.token);
    if (ret.total_count !== ret.teams.length) {
        console.error(`💀Oops! Paging is not implemented at GET /teams. ${ret.total_count} !== ${ret.teams.length}`);
    }
    return ret.teams;
};

const getTeamMembers = async (teamName, param) => {
    const ret = await callEsaApi(`/teams/${teamName}/members`, param.token);
    if (ret.error === 'payment_required') {
        console.error(`💸 accrued team: ${teamName}`);
        return [];
    }
    if (ret.total_count !== ret.members.length) {
        console.error(`💀Oops! Paging is not implemented at GET /teams/:name/members. ${ret.total_count} !== ${ret.members.length}`);
    }
    return ret.members;
};

const sayToSlack = async (tokenPath, text) => {
    const param = {
        hostname: 'hooks.slack.com',
        port: 443,
        path: `/services/${tokenPath}`,
        method: 'POST',
        headers: {'Content-Type': 'application/json'}
    };
    const postData = {
        username: 'esa',
        icon_emoji: ':esa:',
        text
    };
    return new Promise((resolve, reject) => {
        const req = https.request(param, resp => {

            let data = '';
            resp.on('data', chunk => { data += chunk; });
            resp.on('end', () => resolve(data));
        }).on('error', err => reject(err));
        req.write(JSON.stringify(postData));
        req.end();
    });
};

const getSecureParamFromSSM = async (ssm, name) => {
    const ssmSecureParam = await ssm.getParameter({
        Name: name,
        WithDecryption: true,
    }).promise();
    return ssmSecureParam.Parameter.Value;
};

const main = async () => {

    const ssm = new AWS.SSM();

    const token = await getSecureParamFromSSM(ssm, '/CDK/EsaStats2Slack/ESA_API_TOKEN');
    const teams = await getTeams({token});

    const tasks = teams.map(team => team.name).map(name => getTeamMembers(name, {token}));
    const membersList = await Promise.all(tasks);

    const strictMembers = membersList.reduce((ret, members, index) => {
        const teamName = teams[index].name;

        return members.reduce((ret, member) => {
            const email = member.email;
            if (!ret[email]) {
                ret[email] = {
                    email,
                    name: member.name,
                    teams: []
                };
            }
            ret[email].teams.push(teamName);
            return ret;
        }, ret);
    }, {});

    let message = Object.keys(strictMembers).reduce((message, name, index) => {
        message += `${index + 1}. ${name} joined ${strictMembers[name].teams.length} teams. (${strictMembers[name].teams.join(", ")})\n`;
        return message;
    }, '');
    message += `👫 ${Object.keys(strictMembers).length} members, `;
    message += `💰 cost ¥${Object.keys(strictMembers).length * 500}`;

    const incomingWebhookToken = await getSecureParamFromSSM(ssm, '/CDK/EsaStats2Slack/SLACK_WEBHOOK_TOKEN');
    await sayToSlack(incomingWebhookToken, message);
};

exports.handler = main;