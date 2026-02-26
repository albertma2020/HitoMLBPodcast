package keelung.nomar.hitomlbpodcast.controller;

import keelung.nomar.hitomlbpodcast.entity.Episode;
import keelung.nomar.hitomlbpodcast.service.PodcastService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class PodcastController {

    @Autowired
    private PodcastService podcastService;

    @GetMapping("/episodes")
    public List<Episode> getEpisodes() {
        return podcastService.fetchEpisodes();
    }
}