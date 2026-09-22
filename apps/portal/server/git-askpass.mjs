#!/usr/bin/env node
const prompt = process.argv[2] || '';
if (/username/i.test(prompt)) process.stdout.write('x-access-token');
else if (/password/i.test(prompt)) process.stdout.write(process.env.MACHINE_GITHUB_PUSH_TOKEN || '');
