package main

import (
	"fmt"
	"os"
	"github.com/joho/godotenv"

	tea "github.com/charmbracelet/bubbletea"
	"aicommunity.omniq.my.id/cliagent/internal/ui"
)

func main() {
	// Load environment variables from .env if present
	_ = godotenv.Load()
	if os.Getenv("OPENROUTER_API_KEY") == "" {
		fmt.Fprintln(os.Stderr, "error: OPENROUTER_API_KEY is not set")
		os.Exit(1)
	}

	p := tea.NewProgram(
		ui.New(),
		tea.WithAltScreen(),       // full-screen TUI
		tea.WithMouseCellMotion(), // optional: mouse support
	)

	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}
