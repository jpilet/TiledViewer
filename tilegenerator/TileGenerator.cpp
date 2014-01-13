// TileGenerator - (c) 2014 Julien Pilet <julien.pilet@opticode.ch>

#include <opencv2/opencv.hpp>
#include <sstream>
#include <stdio.h>
#include <string>
#include <vector>
#include <sys/stat.h>

using cv::Mat;
using std::vector;
using std::string;

namespace {

class TileGenerator {
  public:
    TileGenerator();

    bool parseArgs(int argc, char *argv[]);
    bool run() const;

  private:
    string pathForLevel(int level) const;
    string pathForX(int level, int x) const;
    string pathForTile(int level, int x, int y) const;
    bool generateTiles(Mat image, int level) const;

    int tileSize_;
    int jpegQuality_;
    int pngCompression_;
    string extension_;
    bool rotateRight_;
    bool rotateLeft_;
    string baseDir_;
    string inputImageFilename_;
    bool downsampleBlur_;
};

bool createDirectory(const string& dir) {
    if (mkdir(dir.c_str(), 0777) != 0) {
        perror(dir.c_str());
        return false;
    }
    return true;
}

TileGenerator::TileGenerator() {
    tileSize_ = 256;
    extension_ = "png";
    rotateRight_ = false;
    rotateLeft_ = false;
    downsampleBlur_ = false;
}

bool TileGenerator::parseArgs(int argc, char *argv[]) {
    int numFreeArgs = 0;
    for (int i = 1; i < argc; ++i) {
        if (argv[i][0] == '-') {
            if (i + 1 < argc) {
                switch (argv[i][1]) {
                    case 's': tileSize_ = atoi(argv[++i]); continue;
                    case 'e': extension_ = argv[++i]; continue;
                    case 'j': jpegQuality_ = atoi(argv[++i]); continue;
                    case 'p': pngCompression_ = atoi(argv[++i]); continue;
                }
            }
            switch (argv[i][1]) {
                case 'r': rotateRight_ = true; continue;
                case 'R': rotateLeft_ = true; continue;
                case 'b': downsampleBlur_ = true; continue;
            }
        } else {
            switch (numFreeArgs++) {
                case 0: inputImageFilename_ = argv[i]; continue;
                case 1: baseDir_ = argv[i]; continue;
            }
        }
        // If we did not hit any "continue" statement, it means there is a
        // problem.
        numFreeArgs = -1;
        break;
    }
    if (numFreeArgs != 2) {
        fprintf(stderr,
                "Usage: %s [options] <image> <destination directory>\n"
                "Options:\n"
                "  -s <size>  maximum tile size\n"
                "  -e <ext>   image extension (png or jpg)\n"
                "  -j <quality> jpeg compression quality: [1, 100]\n"
                "  -p <zfactor> png compression: [0, 9]\n"
                "  -r         rotate original image 90 degrees left\n"
                "  -R         rotate original image 90 degrees right\n"
                "  -b         slightly blur image before downsampling to avoid artifacts\n"
                , argv[0]);
        return false;
    }
    return true;
}

string TileGenerator::pathForLevel(int level) const {
    std::ostringstream dirStream;
    dirStream << baseDir_ << "/" << level;
    return dirStream.str();
}

string TileGenerator::pathForX(int level, int x) const {
    std::ostringstream stream;
    stream << baseDir_ << "/" << level << "/" << x;
    return stream.str();
}

string TileGenerator::pathForTile(int level, int x, int y) const {
    std::ostringstream stream;
    stream << baseDir_ << "/" << level << "/" << x << "/" << y << "." << extension_;
    return stream.str();
}

bool TileGenerator::generateTiles(Mat image, int level) const {
    string levelPath = pathForLevel(level);
    if (!createDirectory(levelPath)) {
        return false;
    }

    std::vector<int> qualityType;
    qualityType.push_back(cv::IMWRITE_JPEG_QUALITY);
    qualityType.push_back(jpegQuality_);
    qualityType.push_back(cv::IMWRITE_PNG_COMPRESSION);
    qualityType.push_back(pngCompression_);

    for (int x = 0; (x * tileSize_) < image.cols; ++x) {
        if (!createDirectory(pathForX(level, x))) {
            return false;
        }

        for (int y = 0; (y * tileSize_) < image.rows; ++y) {
            int width = std::min(tileSize_, image.cols - x * tileSize_);
            int height = std::min(tileSize_, image.rows - y * tileSize_);
            Mat tile = image(cv::Rect(x * tileSize_, y * tileSize_, width, height));
            string path = pathForTile(level, x, y);
            if (!cv::imwrite(path, tile, qualityType)) {
                fprintf(stderr, "%s: Failed to save tile.\n", path.c_str());
                return false;
            }
        }
    }
    return true;
}

bool TileGenerator::run() const {
    Mat source = cv::imread(inputImageFilename_);
    if (source.empty()) {
        fprintf(stderr, "%s: can't load image.\n", inputImageFilename_.c_str());
        return false;
    }

    // Rotation ?
    if (rotateLeft_ || rotateRight_) {
        cv::flip(source.t(), source, (rotateRight_ ? 1 : 0));
    }

    if (!createDirectory(baseDir_)) {
        return false;
    }

    // Generate pyramid.
    vector<Mat> pyramid;
    pyramid.push_back(source);

    while (pyramid.back().cols > tileSize_ || pyramid.back().rows > tileSize_) {
        Mat smaller;
        if (downsampleBlur_) {
            cv::pyrDown(pyramid.back(), smaller);
        } else {
            Mat src = pyramid.back();
            cv::resize(src, smaller, cv::Size(src.cols/2, src.rows/2), cv::INTER_AREA);
        }
        pyramid.push_back(smaller);
    }

    // Save tiles.
    for (int i = 0; i < pyramid.size(); ++i) {
        generateTiles(pyramid[pyramid.size() - i - 1], i);
    }

    // Save size.
    std::ostringstream size;

    string sizeFile = (baseDir_ + "/size.json");
    FILE *f = fopen(sizeFile.c_str(), "w");
    if (f) {
        fprintf(f, "{\"width\":%f,\"height\":%f,\"tileSize\":%d}\n",
                double(pyramid[0].cols) / double(tileSize_ << (pyramid.size() - 1)),
                double(pyramid[0].rows) / double(tileSize_ << (pyramid.size() - 1)),
                tileSize_);
        fclose(f);
    } else {
        perror(sizeFile.c_str());
        return false;
    }

    return true;
}

}  // namespace

int main(int argc, char **argv) {
    TileGenerator generator;

    if (!generator.parseArgs(argc, argv)) {
        return -1;
    }

    if (!generator.run()) {
        return -2;
    }

    return 0;
}

