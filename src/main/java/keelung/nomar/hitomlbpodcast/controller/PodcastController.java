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
                "紅襪", "洋基", "道奇", "大都會", "教士", "太空人", "雙城", "光芒", "水手", "勇士",  "天使", "費城人", "運動家", "白襪",
                "大谷翔平", "Judge", "Soto", "Raleigh", "Devers", "Betts", "Harper",
                "Crochet", "Skubal", "Skenes", "山本由伸", "Kershaw", "Verlander", "Scherzer",
                "張育成", "鄭宗哲",
                "好書我來讀","好劇我來看","人物我來講","轉學生週記"
        );
    }
}