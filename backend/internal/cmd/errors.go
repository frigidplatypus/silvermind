package cmd

import (
	"fmt"
	"os"
)

func printError(cmd string, err error) {
	fmt.Fprintf(os.Stderr, "sbtask: %s: %s\n", cmd, err)
	os.Exit(1)
}

func printWarning(msg string) {
	fmt.Fprintf(os.Stderr, "sbtask: warning: %s\n", msg)
}
