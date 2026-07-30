const fs = require('fs');
const path = require('path');

const SKILL_NAME = 'classify-jewelry-images';

function getBundledSkillRoot() {
  const packagedRoot = process.resourcesPath
    ? path.join(process.resourcesPath, 'skills', SKILL_NAME)
    : null;
  if (packagedRoot && fs.existsSync(packagedRoot)) return packagedRoot;
  return path.join(__dirname, '..', 'skills', SKILL_NAME);
}

function getDefaultLearningDbPath() {
  return path.join(getBundledSkillRoot(), 'learning', 'learning.db');
}

function loadJewelrySkillPrompt(skillRoot = getBundledSkillRoot()) {
  const files = [
    path.join(skillRoot, 'SKILL.md'),
    path.join(skillRoot, 'references', 'taxonomy.md'),
    path.join(skillRoot, 'references', 'process-rules.md'),
  ];
  return files.map((filePath) => {
    if (!fs.existsSync(filePath)) throw new Error(`珠宝分类 Skill 文件缺失: ${path.basename(filePath)}`);
    return fs.readFileSync(filePath, 'utf8').replace(/^---[\s\S]*?---\s*/, '').trim();
  }).join('\n\n');
}

module.exports = {
  SKILL_NAME,
  getBundledSkillRoot,
  getDefaultLearningDbPath,
  loadJewelrySkillPrompt,
};
