package skill

import (
    "bufio"
    "os"
    "path/filepath"
    "strings"
)

type Skill struct {
    Name        string
    Description string
    SystemPrompt string
}

// LoadSkills scans the given directory for *.md files and returns a map of skill name to Skill.
func LoadSkills(dir string) (map[string]Skill, error) {
    skills := make(map[string]Skill)
    entries, err := os.ReadDir(dir)
    if err != nil {
        return nil, err
    }
    for _, e := range entries {
        if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
            continue
        }
        path := filepath.Join(dir, e.Name())
        s, err := parseSkillFile(path)
        if err != nil {
            // ignore malformed files but continue
            continue
        }
        skills[s.Name] = s
    }
    return skills, nil
}

func parseSkillFile(path string) (Skill, error) {
    f, err := os.Open(path)
    if err != nil {
        return Skill{}, err
    }
    defer f.Close()

    var skill Skill
    scanner := bufio.NewScanner(f)
    var inPrompt bool
    var promptLines []string
    for scanner.Scan() {
        line := scanner.Text()
        if strings.HasPrefix(line, "name:") {
            skill.Name = strings.TrimSpace(strings.TrimPrefix(line, "name:"))
        } else if strings.HasPrefix(line, "description:") {
            skill.Description = strings.TrimSpace(strings.TrimPrefix(line, "description:"))
        } else if strings.HasPrefix(line, "system_prompt: |") {
            inPrompt = true
            continue
        } else if inPrompt {
            if strings.HasPrefix(line, "#") && strings.TrimSpace(line) != "" {
                // stop if another top‑level header appears
                inPrompt = false
            }
            // keep leading indentation as part of prompt
            promptLines = append(promptLines, line)
        }
    }
    skill.SystemPrompt = strings.TrimRight(strings.Join(promptLines, "\n"), "\n")
    return skill, nil
}
