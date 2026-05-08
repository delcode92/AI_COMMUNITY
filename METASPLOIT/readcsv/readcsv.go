package readcsv

import (
    "bufio"
    "fmt"
    "os"
)

// readLines reads the file at the given path and returns each line as a string slice.
func readLines(path string) ([]string, error) {
    f, err := os.Open(path)
    if err != nil {
        return nil, err
    }
    defer f.Close()

    scanner := bufio.NewScanner(f)
    var lines []string
    for scanner.Scan() {
        lines = append(lines, scanner.Text())
    }
    if err := scanner.Err(); err != nil {
        return nil, err
    }
    return lines, nil
}

func ReadCSV(filename string) ([]string) {
    lines, err := readLines(filename)
    if err != nil {
        fmt.Fprintf(os.Stderr, "error reading CSV: %v\n", err)
        os.Exit(1)
    }

	  return lines

    // for _, line := range lines {
    //     fmt.Println(line)
    // }
}
