# Custom Skill Creation

Cooney includes an AI-powered skill creation feature that lets you define new learning skills dynamically.

## How It Works

### 1. Describe Your Skill

Click "Create Skill" button and describe what kind of tutor/skill you want:

```
Example input:
"A chemistry tutor for high school students that explains 
reactions, periodic table concepts, and lab safety"
```

### 2. AI Generates YAML Config

Cooney calls the skill creation endpoint which uses an AI model to generate a markdown file in YAML frontmatter format:

```yaml
name: Chemistry Tutor
description: A chemistry tutor for high school students
version: 1.0.0

system_prompt: |
  You are Cooney, a Chemistry Tutor. Your job is to help high 
  school students understand chemistry concepts through:
  
  1. **Clear explanations** - Break down complex chemical concepts
  2. **Real-world examples** - Show how chemistry applies daily
  3. **Safety awareness** - Always mention lab safety
  4. **Visual aids** - Describe molecular structures
```

### 3. Review & Customize

The modal shows the auto-generated fields:
- **Skill Name** - Editable text field
- **Description** - Editable text field  
- **System Prompt** - Textarea with full prompt

You can customize any field before saving.

### 4. Save to Custom Skills

Clicking "Save Skill" writes the `.md` file to:
```
/backend/skills/custom/chemistry-tutor.md
```

This skill then appears in the selector for future use.

## API Endpoints

### Create Skill (AI Generation)
```
POST /api/skills/create
{
  "message": "Describe your skill...",
  "userId": "user-123"
}

Response:
{
  "skillYaml": "name: ...\ndescription: ......"
}
```

### Save Custom Skill
```
POST /api/skills/save
{
  "name": "Chemistry Tutor",
  "description": "...",
  "system_prompt": "...",
  "userId": "user-123"
}

Response:
{
  "success": true,
  "filename": "chemistry-tutor.md"
}
```

## Usage Flow

```
User clicks "Create Skill"
    │
    ▼
User describes skill in modal
    │
    ▼
AI generates skill YAML
    │
    ▼
Modal shows auto-filled fields
    │
    ├─► User can edit name, description, prompt
    │
    └─► User clicks "Save Skill"
         │
         ▼
     Skill file saved to /custom/
                   │
                   ▼
             Skill appears in selector
```

## Tips for Better Skills

### Good descriptions:
- ✅ "A Python programming tutor for beginners focusing on variables and functions"
- ✅ "A language learning buddy for Spanish that practices conversation"
- ✅ "A history explainer for medieval Europe with interactive quizzes"

### Vague descriptions (avoid):
- ❌ "A tutor"
- ❌ "Help with school"
- ❌ "Learning skill"

## Example Custom Skills

```
- Math Equation Solver
- Biology Cell Biology Guide
- JavaScript Framework Coach
- Language Practice Partner
- Coding Interview Prep
```

## File Structure

```
skills/
├── default/        # Pre-built skills (admin only)
│   ├── science.md
│   ├── math.md
│   └── ...
└── custom/         # User-created skills
    ├── chemistry-tutor.md
    └── spanish-buddy.md
```

Custom skills are automatically loaded and available alongside default skills.
