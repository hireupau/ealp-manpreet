import { createJiraClient } from "../src/jira.js";

const [, , issueKey, statusName] = process.argv;

if (!issueKey) {
  console.error("Usage: npm run try:jira -- ISSUE-KEY [STATUS]");
  process.exit(1);
}

const jira = createJiraClient();

if (statusName) {
  await jira.transitionIssue(issueKey, statusName);
}

const issue = await jira.getIssue(issueKey);
console.log(`${issue.key} [${issue.status}] ${issue.summary}`);
