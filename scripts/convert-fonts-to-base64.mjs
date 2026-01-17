import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fontsDir = path.join(__dirname, '../public/fonts');
const outputFile = path.join(__dirname, '../src/utils/fonts.ts');

const fonts = [
  { name: 'NanumGothic', file: 'NanumGothic.ttf', style: 'normal' },
  { name: 'NanumGothicBold', file: 'NanumGothicBold.ttf', style: 'bold' },
];

let output = `// 한글 폰트 Base64 데이터
// 이 파일은 scripts/convert-fonts-to-base64.mjs 스크립트로 자동 생성됩니다.

`;

for (const font of fonts) {
  const fontPath = path.join(fontsDir, font.file);
  
  if (!fs.existsSync(fontPath)) {
    console.warn(`폰트 파일을 찾을 수 없습니다: ${fontPath}`);
    continue;
  }

  const fontBuffer = fs.readFileSync(fontPath);
  const base64 = fontBuffer.toString('base64');
  
  const varName = font.style === 'bold' ? 'NANUM_GOTHIC_BOLD_BASE64' : 'NANUM_GOTHIC_REGULAR_BASE64';
  
  output += `export const ${varName} = '${base64}';\n\n`;
}

output += `// 폰트가 로드되었는지 확인
export function hasKoreanFont(): boolean {
  return NANUM_GOTHIC_REGULAR_BASE64.length > 0 && NANUM_GOTHIC_BOLD_BASE64.length > 0;
}
`;

fs.writeFileSync(outputFile, output, 'utf-8');
console.log(`✅ 폰트 변환 완료: ${outputFile}`);
console.log(`   - Regular: ${fonts.find(f => f.style === 'normal')?.file}`);
console.log(`   - Bold: ${fonts.find(f => f.style === 'bold')?.file}`);
