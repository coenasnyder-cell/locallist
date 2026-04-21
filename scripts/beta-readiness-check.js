 
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();

const requiredFiles = [
  'COMPLIANCE_CHECKLIST.md',
  'RELEASE_CHECKLIST.md',
  'QUALITY_GATES.md',
  'BETA_ROLLOUT_PLAYBOOK.md',
  'public/privacy.html',
  'public/terms.html',
  'app/(app)/privacy-policy.tsx',
  'app/(app)/termsOfUse.tsx',
  'app/(app)/beta-testing.tsx',
  'app/(app)/beta-feedback.tsx',
  'firestore.rules',
  'eas.json',
];

function exists(relPath) {
  return fs.existsSync(path.join(projectRoot, relPath));
}

function parseEasProfiles() {
  const easPath = path.join(projectRoot, 'eas.json');
  if (!fs.existsSync(easPath)) return { ok: false, message: 'missing eas.json' };

  try {
    const json = JSON.parse(fs.readFileSync(easPath, 'utf8'));
    const build = json.build || {};
    const devEnv = build.development?.env?.EXPO_PUBLIC_APP_ENV;
    const previewEnv = build.preview?.env?.EXPO_PUBLIC_APP_ENV;
    const prodEnv = build.production?.env?.EXPO_PUBLIC_APP_ENV;

    const ok = devEnv === 'development' && previewEnv === 'preview' && prodEnv === 'production';
    return {
      ok,
      message: ok
        ? 'eas profile env mapping looks correct'
        : 'eas profile env mapping is missing or incorrect',
    };
  } catch {
    return { ok: false, message: 'invalid eas.json' };
  }
}

function checkAnalyticsRulePresence() {
  const rulesPath = path.join(projectRoot, 'firestore.rules');
  if (!fs.existsSync(rulesPath)) return { ok: false, message: 'missing firestore.rules' };

  const content = fs.readFileSync(rulesPath, 'utf8');
  const hasCollection = content.includes('match /appAnalyticsEvents/{document}');
  const hasCreate = content.includes('allow create: if request.auth != null');
  return {
    ok: hasCollection && hasCreate,
    message: hasCollection && hasCreate
      ? 'appAnalyticsEvents rule detected'
      : 'appAnalyticsEvents rule missing or incomplete',
  };
}

function checkBetaFeedbackRulePresence() {
  const rulesPath = path.join(projectRoot, 'firestore.rules');
  if (!fs.existsSync(rulesPath)) return { ok: false, message: 'missing firestore.rules' };

  const content = fs.readFileSync(rulesPath, 'utf8');
  const hasCollection = content.includes('match /betaFeedback/{document}');
  const hasCreate = content.includes('request.resource.data.issueType in [\'bug\', \'ux\', \'performance\', \'crash\', \'payment\', \'other\']');
  return {
    ok: hasCollection && hasCreate,
    message: hasCollection && hasCreate
      ? 'betaFeedback rule detected'
      : 'betaFeedback rule missing or incomplete',
  };
}

function run() {
  console.log('Step 6 Beta/Compliance Readiness Check\n');

  const missing = requiredFiles.filter((f) => !exists(f));
  if (missing.length) {
    console.log('Missing files:');
    missing.forEach((f) => console.log(`- ${f}`));
  } else {
    console.log('All required compliance/beta files found.');
  }

  const eas = parseEasProfiles();
  const rules = checkAnalyticsRulePresence();
  const betaRules = checkBetaFeedbackRulePresence();

  console.log(`\nEAS check: ${eas.ok ? 'PASS' : 'FAIL'} - ${eas.message}`);
  console.log(`Firestore rules check: ${rules.ok ? 'PASS' : 'FAIL'} - ${rules.message}`);
  console.log(`Beta feedback rules check: ${betaRules.ok ? 'PASS' : 'FAIL'} - ${betaRules.message}`);

  const pass = missing.length === 0 && eas.ok && rules.ok && betaRules.ok;
  console.log(`\nOverall: ${pass ? 'PASS' : 'FAIL'}`);
  process.exit(pass ? 0 : 1);
}

run();
