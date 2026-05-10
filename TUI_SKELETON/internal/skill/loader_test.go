package skill

import (
	"os"
	"testing"
)

func TestLoadSkills(t *testing.T) {
	// Create temp directory with test skills
	tmpDir := "/tmp/test_skills"
	if err := os.MkdirAll(tmpDir, 0755); err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	skillContent := `# Test Skill
name: TestSkill
description: A test skill
system_prompt: |
  You are a test assistant.`

	skillFile := tmpDir + "/test.md"
	if err := os.WriteFile(skillFile, []byte(skillContent), 0644); err != nil {
		t.Fatalf("failed to write skill file: %v", err)
	}

	skills, err := LoadSkills(tmpDir)
	if err != nil {
		t.Fatalf("LoadSkills failed: %v", err)
	}

	if len(skills) != 1 {
		t.Errorf("expected 1 skill, got %d", len(skills))
	}

	s, ok := skills["TestSkill"]
	if !ok {
		t.Fatal("TestSkill not found in skills map")
	}

	if s.Name != "TestSkill" {
		t.Errorf("expected Name TestSkill, got %s", s.Name)
	}
	if s.Description != "A test skill" {
		t.Errorf("unexpected description: %s", s.Description)
	}
}