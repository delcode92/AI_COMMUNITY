package ui

import "github.com/charmbracelet/lipgloss"

// opencode-inspired color palette
const (
	// Darker black background
	colorBg       = "#000000"
	colorBgPanel  = "#0a0a0a"
	colorBorder   = "#1a1a1a"
	// Light orange accent colors
	colorGreen    = "#ffb86c" // primary accent (was green)
	colorTeal     = "#ffb86c" // secondary accent
	colorMuted    = "#555555"
	colorText     = "#f5f5f5"
	colorSubtle   = "#aaaaaa"
	colorUser     = "#ffb86c"
	colorError    = "#ff5555"
	colorWaiting  = "#ffb86c"
)

var (
	// Status bar at the bottom
	StatusBarStyle = lipgloss.NewStyle().
			Background(lipgloss.Color(colorBgPanel)).
			Foreground(lipgloss.Color(colorMuted)).
			Padding(0, 1)

	StatusKeyStyle = lipgloss.NewStyle().
			Background(lipgloss.Color(colorBgPanel)).
			Foreground(lipgloss.Color(colorGreen)).
			Bold(true)

	StatusModelStyle = lipgloss.NewStyle().
				Background(lipgloss.Color(colorBgPanel)).
				Foreground(lipgloss.Color(colorTeal))

	// Chat messages
	UserLabelStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorUser)).
			Bold(true)

	AssistantLabelStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color(colorGreen)).
				Bold(true)

	ErrorStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorError))

	WaitingStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorWaiting))

	MessageStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorText))

	SubtleStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorSubtle))

	// Input area
	InputBorderStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color(colorBorder)).
				Padding(0, 1)

	InputFocusedBorderStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(lipgloss.Color(colorGreen)).
				Padding(0, 1)

	// Divider
	DividerStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color(colorBorder))
)
