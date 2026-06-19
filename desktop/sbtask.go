package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/justin/sbtask/pkg/config"
	"github.com/justin/sbtask/pkg/serve"
)

const defaultPort = 7433

type ServiceHealth struct {
	State     string `json:"state"`
	Port      int    `json:"port"`
	SpaceURL  string `json:"space_url"`
	LastError string `json:"error,omitempty"`
}

type SbtaskServer struct {
	server *http.Server
	srv    *serve.Server
	health ServiceHealth
}

func StartSbtaskServer(cfgPath string) (*SbtaskServer, error) {
	s := &SbtaskServer{
		health: ServiceHealth{State: "starting", Port: defaultPort},
	}

	log.Printf("[silvermind] loading config from %s", cfgPath)
	cfg, err := config.LoadConfig(cfgPath)
	if err != nil {
		s.health.State = "failed"
		s.health.LastError = fmt.Sprintf("config error: %v", err)
		log.Printf("[silvermind] config load error: %v", err)
		return s, err
	}

	activeSpace := cfg.ActiveSpace
	spaceURL := ""
	for name, sp := range cfg.Spaces {
		if name == activeSpace {
			spaceURL = sp.Space
			break
		}
	}
	s.health.SpaceURL = spaceURL

	log.Printf("[silvermind] starting sbtask serve: space=%q url=%s port=%d", activeSpace, spaceURL, defaultPort)
	s.srv = serve.NewServer(cfg, activeSpace, spaceURL, "", "localhost", defaultPort)

	go func() {
		s.health.State = "running"
		s.health.LastError = ""
		log.Printf("[silvermind] sbtask serve running on localhost:%d space=%s", defaultPort, spaceURL)
		if err := s.srv.Start(); err != nil {
			s.health.State = "failed"
			s.health.LastError = err.Error()
			log.Printf("[silvermind] sbtask serve error: %v", err)
		}
	}()

	time.Sleep(100 * time.Millisecond)
	return s, nil
}

func (s *SbtaskServer) Stop() {
	if s.srv != nil {
		s.srv.Shutdown()
	}
	s.health.State = "stopped"
}

func (s *SbtaskServer) GetHealth() ServiceHealth {
	return s.health
}
