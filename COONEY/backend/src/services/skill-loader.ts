import fs from 'fs';
import path from 'path';

export interface SkillConfig {
  name: string;
  description: string;
  version: string;
  system_prompt: string;
  isCustom?: boolean;
  file?: string;
}

export class SkillLoader {
  private basePath: string;

  constructor(basePath: string = './backend/skills') {
    this.basePath = basePath;
  }

  async loadAll(): Promise<SkillConfig[]> {
    const defaultPath = path.join(this.basePath, 'default');
    const customPath = path.join(this.basePath, 'custom');

    const skills: SkillConfig[] = [];

    // Load default skills
    if (fs.existsSync(defaultPath)) {
      const files = fs.readdirSync(defaultPath).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const config = await this.loadSkill(file, defaultPath);
        if (config) skills.push({ ...config, isCustom: false });
      }
    }

    // Load custom skills
    if (fs.existsSync(customPath)) {
      const files = fs.readdirSync(customPath).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const config = await this.loadSkill(file, customPath);
        if (config) skills.push({ ...config, isCustom: true });
      }
    }

    return skills;
  }

  async loadSkill(filename: string, dirPath: string): Promise<SkillConfig | null> {
    const filePath = path.join(dirPath, filename);
    const content = fs.readFileSync(filePath, 'utf-8');

    const config: SkillConfig = {
      name: '',
      description: '',
      version: '',
      system_prompt: '',
      file: filename.replace('.md', ''),
    };

    // Parse YAML-like frontmatter
    const parts = content.match(/name: (.+)\ndescription: (.+)\nversion: (.+)\n\nsystem_prompt: \|/s);
    if (!parts) return null;

    config.name = parts[1].trim();
    config.description = parts[2].trim();
    config.version = parts[3].trim();

    // Get system prompt (everything after system_prompt: | and first newline)
    const promptMatch = content.match(/system_prompt: \|\n([\s\S]+)/);
    if (promptMatch) {
      config.system_prompt = promptMatch[1].trim();
    }

    return config;
  }

  async getSkillById(skillId: string): Promise<SkillConfig | null> {
    const skills = await this.loadAll();
    // Normalize skillId: convert slashes to dashes for matching
    const normalized = skillId.toLowerCase().replace(/\//g, '-');
    return skills.find(s => s.file === normalized || s.file === skillId.toLowerCase() || s.name.toLowerCase() === skillId.toLowerCase()) || null;
  }
}
