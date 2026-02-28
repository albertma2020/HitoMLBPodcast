package keelung.nomar.hitomlbpodcast.controller;

import keelung.nomar.hitomlbpodcast.entity.Episode;
import keelung.nomar.hitomlbpodcast.service.PodcastService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
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

    @GetMapping("/recommended-keywords")
    public List<String> getRecommendedKeywords() {
        return Arrays.asList(
                "洋基", "紅襪", "道奇", "大都會", "教士", "太空人",
                "勇士", "光芒", "水手", "雙城", "巨人", "白襪",
                "大谷翔平", "Judge", "Raleigh", "Soto", "Devers", "山本由伸",
                "Crochet", "Skubal", "Skenes", "Cole", "張育成", "鄭宗哲"
        );
    }
}