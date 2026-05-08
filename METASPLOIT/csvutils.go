package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// CSVProcessor handles CSV file operations
type CSVProcessor struct {
	FilePath string
}

// NewCSVProcessor creates a new CSVProcessor instance
func NewCSVProcessor(filePath string) *CSVProcessor {
	return &CSVProcessor{
		FilePath: filePath,
	}
}

// ReadAndParseCSV reads a CSV file and returns all URLs found
func (cp *CSVProcessor) ReadAndParseCSV() ([]string, error) {
	// Open the CSV file
	file, err := os.Open(cp.FilePath)
	if err != nil {
		return nil, fmt.Errorf("error opening CSV file: %v", err)
	}
	defer file.Close()

	// Create a scanner to read line by line
	scanner := bufio.NewScanner(file)
	
	var urls []string
	lineNumber := 0
	
	for scanner.Scan() {
		lineNumber++
		line := strings.TrimSpace(scanner.Text())
		
		// Skip empty lines
		if line == "" {
			continue
		}
		
		// Split the line by commas to get individual URLs
		lineUrls := strings.Split(line, ",")
		
		for _, url := range lineUrls {
			url = strings.TrimSpace(url)
			if url != "" {
				urls = append(urls, url)
			}
		}
	}
	
	// Check for scanning errors
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading CSV file: %v", err)
	}
	
	return urls, nil
}

// ProcessCSVFile processes the CSV file and prints results
func (cp *CSVProcessor) ProcessCSVFile() error {
	urls, err := cp.ReadAndParseCSV()
	if err != nil {
		return err
	}

	fmt.Println("=== URLs from sources.csv ===")
	
	for i, url := range urls {
		fmt.Printf("URL %d: %s\n", i+1, url)
	}
	
	fmt.Printf("\nTotal URLs found: %d\n", len(urls))
	return nil
}