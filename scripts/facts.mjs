// Lists every business fact that's still a placeholder (unconfirmed) or missing (todo).
// Run: npm run facts        STRICT=1 npm run facts  (exits 1 if anything is left: use before launch)
const { pending } = await import('../src/content/facts.ts');
const todo = pending.filter((p) => p.kind === 'todo');
const unconf = pending.filter((p) => p.kind === 'unconfirmed');
console.log(`\nMissing (${todo.length}): the site shows honest generic copy until you fill these\n`);
todo.forEach((p) => console.log('  ·', p.note));
console.log(`\nUnconfirmed (${unconf.length}): shown on the site, please confirm\n`);
unconf.forEach((p) => console.log('  ·', p.note, '\n      now:', JSON.stringify(p.value)));
console.log('\nEdit src/content/facts.ts. See the comment at the top for how.\n');
if (process.env.STRICT && pending.length) process.exit(1);
