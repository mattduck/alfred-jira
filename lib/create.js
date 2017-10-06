var Jira = require('./jira');
var Workflow = require('./workflow');
var log = require('./alfred-log');
var config = require('./jira/config');
var wf = new Workflow();
let storage = wf.storage;

let projects = Jira.getOptions().available_projects;

const feedback = (items, data) => {
  wf.addItems(items);
  wf.feedback();
  storage.set('create-config', data);
}

module.exports = query => {
  let context = query.split(wf._sep);
  let search = context.pop() || '';

  context = context.filter(String);

  let issueConfig = storage.get('create-config') || {
    summary: '',
    assignee: '',
    project: '',
    issuetype: ''
  };

  for (var key of ['project', 'assignee', 'issuetype']) {
    let projectIndex = context.findIndex(s => s.trim() == key);
    if (projectIndex > -1 && projectIndex < context.length - 2) {
      // Set Project
      issueConfig[key] = context[projectIndex + 1];
      // Remove it from the path.
      context.splice(projectIndex, 2);
    }
  }

  switch((context[context.length-1] || '').trim()) {
    case 'project':
      projects = projects
        .filter(s => new RegExp(search, 'i').test(s))
        .map(project => ({
          title: project,
          valid: false,
          autocomplete: context.concat(project, 'create', issueConfig.summary).join(wf._sep),
          projectIcon: project + '.png'
        }));

      feedback(projects, issueConfig);
      break;

    case 'assignee':
      Jira.getUsers().then(users => {
        users = users
          .filter(s => new RegExp(search, 'i').test(s.name))
          .sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
          .map(user => ({
            title: user.name,
            valid: false,
            userIcon: user.name.replace(/[^a-z0-9]/gi,'_') + '.png',
            autocomplete: context.concat(user.username, 'create', issueConfig.summary).join(wf._sep),
          }));

          feedback(users, issueConfig);
      });
      break;

    case 'issuetype':
      Jira.getIssueTypes().then(types => {
        types = types
          .filter(s => new RegExp(search, 'i').test(s.name))
          .map(type => ({
            title: type.name,
            valid: false,
            autocomplete: context.concat(type.name, 'create', issueConfig.summary).join(wf._sep),
            icon: type.name == issueConfig.issuetype ? 'label.png' : 'labeloutline.png'
          }));

          feedback(types, issueConfig);
      });
      break;

    default:
      Jira.getUsers().then(users => {
        issueConfig.summary = search.trim().replace(/\.+$/, '.');

        if (!issueConfig.assignee) {
          issueConfig.assignee = config.user;
        }

        let assignee = (users.find(user => user.username == issueConfig.assignee).name || { name: '' });
        let valid = (issueConfig.summary.length > 1) && new RegExp('\\.' + '$', '').test(issueConfig.summary);


        let menu = [{
            title: `Summary: ${issueConfig.summary}`,
            valid: valid === true,
            autocomplete: wf._sep + 'create ' + wf._sep + issueConfig.summary + '.',
            arg: 'create-issue',
            icon: 'title.png',
            subtitle: valid ? 'Press enter to create issue.' : null,
            cmdMod: valid ? {
              subtitle: 'Press enter to create & open issue.',
              arg: 'create-issue-open'
            } : null
          },{
            title: `Assignee: ${assignee}`,
            valid: false,
            autocomplete: wf._sep + 'create ' + wf._sep + 'assignee ' + wf._sep,
            userIcon: assignee.replace(/[^a-z0-9]/gi,'_') + '.png',
          },{
            title: `Project: ${issueConfig.project}`,
            valid: false,
            projectIcon: `${issueConfig.project}.png`,
            autocomplete: wf._sep + 'create ' + wf._sep + 'project ' + wf._sep
          },{
            title: `Issue Type: ${issueConfig.issuetype}`,
            valid: false,
            autocomplete: wf._sep + 'create ' + wf._sep + 'issuetype ' + wf._sep,
            icon: issueConfig.issuetype ? 'label.png' : 'labeloutline.png'
          }];

        feedback(menu, issueConfig);
      });

  }
}