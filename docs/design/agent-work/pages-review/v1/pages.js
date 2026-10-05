// Biome's page specs as HTML (AGENT-WORK-01 Pages review prototype). Each entry stands for one file in Pages' repository,
// for example pages/sign-up.html, written with biome-kit.js tags only. data-change marks what a revision changed against
// the one before (new, changed, removed) and data-id names it for the change list. Illustrative content.
window.BIOME_PAGES = (() => {
  const marketing = v => `<bk-page footer="Small worlds. Endless possibilities.">
  <bk-topbar><bk-button variant="outlined" go="login">Log in</bk-button></bk-topbar>
  <bk-hero eyebrow="Small worlds" headline="Grow a living world, one tile at a time." lede="Plant a woodland, watch rabbits find it, and see what happens by spring.">
    <bk-row>${v === 'r3'
      ? '<bk-button go="login">Log in</bk-button>'
      : '<bk-button go="signup" data-change="changed" data-id="cta">Start your world</bk-button><bk-button variant="outlined" go="login" data-change="new" data-id="login-btn">Log in</bk-button>'}</bk-row>
    ${v === 'r3' ? '<bk-link lead="New here?" data-change="removed" data-id="invite">Ask for an invite</bk-link>' : ''}
  </bk-hero>
</bk-page>`;
  const login = `<bk-page footer="Small worlds. Endless possibilities.">
  <bk-topbar></bk-topbar>
  <bk-card eyebrow="Welcome back" headline="Log in to your biome">
    <bk-field label="Email" type="email" value="ada@example.com"></bk-field>
    <bk-field label="Password" type="password" value="moss-and-fern"></bk-field>
    <bk-button full go="setup">Log in</bk-button>
    <bk-link lead="New here?">Ask for an invite</bk-link>
  </bk-card>
</bk-page>`;
  const signup = `<bk-page footer="Small worlds. Endless possibilities.">
  <bk-topbar></bk-topbar>
  <bk-card eyebrow="Join biome" headline="Make your account" data-change="new" data-id="page">
    <bk-steps current="1" total="2"></bk-steps>
    <bk-field label="Your name" value="Ada"></bk-field>
    <bk-field label="Email" type="email" value="ada@example.com"></bk-field>
    <bk-field label="Password" type="password" value="moss-and-fern" hint="At least 10 characters"></bk-field>
    <bk-button full go="check-email">Create account</bk-button>
    <bk-link lead="Already have an account?" go="login">Log in</bk-link>
  </bk-card>
</bk-page>`;
  const checkEmail = round2 => `<bk-page footer="Small worlds. Endless possibilities.">
  <bk-topbar></bk-topbar>
  <bk-card eyebrow="Almost there" headline="Check your email"${round2 ? '' : ' data-change="new" data-id="page"'}>
    <bk-text>We sent a link to ada@example.com. Open it on this device to confirm your account.</bk-text>
    ${round2 ? '<bk-notice icon="⏳" data-change="new" data-id="expiry">The link lasts 24 hours.</bk-notice>' : '<bk-notice icon="✉️">Can\'t find it? Check your spam folder.</bk-notice>'}
    <bk-button full go="setup">Open the email</bk-button>
    <bk-row><bk-button variant="text">Send it again</bk-button>${round2 ? '<bk-button variant="text" go="signup" data-change="new" data-id="other-email">Use a different email</bk-button>' : ''}</bk-row>
  </bk-card>
</bk-page>`;
  const setup = v => `<bk-page footer="Small worlds. Endless possibilities.">
  <bk-topbar><bk-button variant="outlined">My world</bk-button></bk-topbar>
  <bk-card eyebrow="Your first biome" headline="A place for life|to begin.">
    ${v === 'r3' ? '' : '<bk-steps current="2" total="2" data-change="new" data-id="steps"></bk-steps>'}
    ${v === 'r3' ? '<bk-text>Hi Demo newcomer. Start with a temperate world of grasslands, woodland, and water.</bk-text>'
      : '<bk-text data-change="changed" data-id="greet">Hi Ada. Start with a temperate world of grasslands, woodland, and water.</bk-text>'}
    <bk-field label="World name" value="My first biome"></bk-field>
    <bk-choice icon="🌳" title="Temperate woodland" meta="Rabbits, deer, and foxes · Spring" selected></bk-choice>
    <bk-button full go="world">Create my world</bk-button>
  </bk-card>
</bk-page>`;
  const world = '<bk-world name="Mossbank" season="Spring"></bk-world>';
  return {
    pages: {
      marketing: { name: 'Marketing', file: 'pages/marketing.html' }, login: { name: 'Log in', file: 'pages/log-in.html' }, signup: { name: 'Sign up', file: 'pages/sign-up.html' },
      'check-email': { name: 'Check your email', file: 'pages/check-email.html' }, setup: { name: 'Initial setup', file: 'pages/initial-setup.html' }, world: { name: 'World', file: 'pages/world.html' } },
    revisions: {
      r3: { label: 'r3', flow: ['marketing', 'login', 'setup', 'world'], html: { marketing: marketing('r3'), login, setup: setup('r3'), world } },
      r4: { label: 'r4', flow: ['marketing', 'signup', 'check-email', 'setup', 'world'], html: { marketing: marketing('r4'), login, signup, 'check-email': checkEmail(false), setup: setup('r4'), world } },
      r5: { label: 'r5', flow: ['marketing', 'signup', 'check-email', 'setup', 'world'], html: { marketing: marketing('r4'), login, signup, 'check-email': checkEmail(true), setup: setup('r4'), world } },
    },
    // What each revision changed on each page, against the one before; ids point at data-id in the page.
    changes: {
      r4: {
        marketing: [['cta', 'changed', 'The main button is Start your world and goes to Sign up (it was Log in).'], ['login-btn', 'new', 'Log in moves to a second, outlined button.'], ['invite', 'removed', 'Ask for an invite is gone: anyone can sign up now.']],
        signup: [['page', 'new', 'New page: name, email and password, then Create account.']],
        'check-email': [['page', 'new', 'New page: tells you where the link went; Open the email goes on to setup.']],
        setup: [['steps', 'new', 'Shows Step 2 of 2, matching Sign up.'], ['greet', 'changed', 'Greets you by the name you gave on Sign up.']],
        login: [[null, 'removed', 'Log in stays in the app but is no longer a step for a new visitor.']],
      },
      r5: { 'check-email': [['expiry', 'new', 'Says how long the link lasts, in place of the spam-folder tip (your note).'], ['other-email', 'new', 'Adds Use a different email, back to Sign up.']] },
    },
  };
})();
