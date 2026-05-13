package ui

import (
	"encoding/json"
	"regexp"
	"strings"
)

// extractToolCommands parses /tool commands from assistant response
func (m *Model) extractToolCommands(response string) []pendingTool {
	var tools []pendingTool
	seen := make(map[string]bool) // deduplicate

	// Pattern 1: /tool {"tool":"name","args":[...]}
	toolPattern := regexp.MustCompile(`(?i)/tool\s*(\{[^}]*"tool"[^}]*\})`)
	for _, match := range toolPattern.FindAllStringSubmatch(response, -1) {
		if len(match) > 1 {
			key := match[1]
			if !seen[key] {
				seen[key] = true
				m.parseAndAddTool(match[1], &tools)
			}
		}
	}

	// Pattern 2: bare JSON object containing tool/args
	jsonPattern := regexp.MustCompile(`\{[^{}]*"tool"\s*:\s*"[^"]+"[^{}]*"args"\s*:\s*\[[^\]]*\][^{}]*\}`)
	for _, match := range jsonPattern.FindAllString(response, -1) {
		if !seen[match] {
			seen[match] = true
			m.parseAndAddTool(match, &tools)
		}
	}

	// Pattern 3: Tool calls in markdown code blocks (e.g., "> <tool {...}", ">>>tool {...}")
	// Handles format: > followed by optional < and tool JSON, or >>>tool
	codeBlockPattern := regexp.MustCompile(`(?:>>>|\s*>\s*<?)tool\s*(\{[^}]+\})`)
	for _, match := range codeBlockPattern.FindAllStringSubmatch(response, -1) {
		if len(match) > 1 {
			key := match[1]
			if !seen[key] {
				seen[key] = true
				m.parseAndAddTool(match[1], &tools)
			}
		}
	}

	// Pattern 4: OpenAI-style XML-wrapped tool calls: <toolname>{"command":"...","args":[...]}</toolname>
	xmlPattern := regexp.MustCompile(`<(\w+)>\s*(\{[^}]+\})\s*</\w+>`)
	for _, match := range xmlPattern.FindAllStringSubmatch(response, -1) {
		if len(match) > 2 && !seen[match[0]] {
			seen[match[0]] = true
			toolName := match[1]
			// Parse inner JSON which has "command" and "args"
			var inner struct {
				Command string   `json:"command"`
				Args    []string `json:"args"`
			}
			if err := json.Unmarshal([]byte(match[2]), &inner); err == nil && inner.Command != "" {
				allArgs := append([]string{inner.Command}, inner.Args...)
				tools = append(tools, pendingTool{name: toolName, args: strings.Join(allArgs, " ")})
			}
		}
	}

	return tools
}

func (m *Model) parseAndAddTool(raw string, tools *[]pendingTool) {
	var parsed struct {
		Tool    string   `json:"tool"`
		Command string   `json:"command"`
		Args    []string `json:"args"`
	}
	if err := json.Unmarshal([]byte(raw), &parsed); err == nil {
		name := parsed.Tool
		if name == "" {
			name = parsed.Command
		}
		if name != "" {
			*tools = append(*tools, pendingTool{name: name, args: strings.Join(parsed.Args, " ")})
		}
	}
}