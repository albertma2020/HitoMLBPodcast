package keelung.nomar.hitomlbpodcast.entity;

public class Chapter {
    private String title;
    private String timestamp;
    private int startSeconds;

    public Chapter(String title, String timestamp, int startSeconds) {
        this.title = title;
        this.timestamp = timestamp;
        this.startSeconds = startSeconds;
    }

    public String getTitle() {
        return title;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public int getStartSeconds() {
        return startSeconds;
    }
}